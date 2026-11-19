import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Sequence, Device, Assignment, MaintenanceLog, AuditLog } from './models';
import { authenticate, authorize, sanitizeNoSqlAndXss, validate } from './middleware';
import { getJwtSecret } from './config.js';

const app = express();
const allowedOrigins = new Set(['http://localhost:4200', 'http://localhost:3000', 'https://device-pulse.netlify.app', process.env.CLIENT_URL].filter(Boolean) as string[]);
app.use(helmet());
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.has(origin)) cb(null, true); else cb(new Error('Origin not allowed')); }, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeNoSqlAndXss);

async function recordAudit(entry:{
  entityType:'DEVICE'|'ASSIGNMENT'|'MAINTENANCE'|'USER';
  entityId:mongoose.Types.ObjectId|string;
  action:string;
  performedBy:mongoose.Types.ObjectId|string;
  previousState:object|null;
  newState:object|null;
  ipAddress:string|undefined;
},session?:mongoose.ClientSession):Promise<void>{
  await AuditLog.create([entry],session?{session}:{});
}

app.get('/api/health', (_req,res)=>res.json({ status:'ok', mongo:mongoose.connection.readyState===1?'connected':'disconnected' }));

app.post('/api/auth/login', validate(z.object({body:z.object({email:z.string().email(),password:z.string().min(1)})})), async (req,res)=>{
  const user=await User.findOne({email:req.body.email,isActive:true}).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password,(user as any).passwordHash))) return res.status(401).json({error:'Invalid credentials'});
  await recordAudit({entityType:'USER',entityId:user._id,action:'USER_LOGIN',performedBy:user._id,previousState:null,newState:{email:user.email,role:user.role},ipAddress:req.ip});
  const token=jwt.sign({userId:user.id,role:user.role},getJwtSecret(),{expiresIn:'8h'});
  res.cookie('token',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.NODE_ENV==='production'? 'none':'lax',maxAge:28800000});
  res.json({id:user.id,employeeId:user.employeeId,fullName:user.fullName,email:user.email,role:user.role,department:user.department});
});
app.post('/api/auth/logout',authenticate,async(req,res)=>{
  await recordAudit({entityType:'USER',entityId:req.auth!.userId,action:'USER_LOGOUT',performedBy:req.auth!.userId,previousState:{authenticated:true},newState:null,ipAddress:req.ip});
  res.clearCookie('token');res.status(204).send();
});
app.get('/api/auth/me',authenticate,async(req,res)=>{
  const user=await User.findById(req.auth!.userId);
  res.json(user);
});

app.get('/api/users',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),async(req,res)=>{
  const {active,department,page='1',limit='100'}=req.query as Record<string,string>;
  const filter:Record<string,unknown>={};
  if(active==='true')filter['isActive']=true;
  if(active==='false')filter['isActive']=false;
  if(department?.trim())filter['department']=department.trim();
  const currentPage=Math.max(1,Number(page)||1),pageSize=Math.min(100,Math.max(1,Number(limit)||100));
  const [items,total]=await Promise.all([
    User.find(filter).select('-passwordHash').sort({fullName:1}).skip((currentPage-1)*pageSize).limit(pageSize),
    User.countDocuments(filter)
  ]);
  res.json({items,total,page:currentPage,pages:Math.ceil(total/pageSize)});
});

app.post('/api/users',authenticate,authorize('IT_ADMIN'),validate(z.object({body:z.object({
  fullName:z.string().trim().min(1),email:z.string().trim().email(),
  password:z.string().min(8),role:z.enum(['IT_ADMIN','ASSET_MANAGER','EMPLOYEE']),department:z.string().trim().min(1)
})})),async(req,res)=>{
  const session=await mongoose.startSession();
  let created;
  try{
    await session.withTransaction(async()=>{
      const [highestEmployee]=await User.aggregate([
        {$match:{employeeId:/^EMP-\d+$/}},
        {$project:{numericId:{$toLong:{$substrBytes:['$employeeId',4,-1]}}}},
        {$sort:{numericId:-1}},
        {$limit:1}
      ]).session(session);
      const currentMax=Number(highestEmployee?.numericId??0);
      const sequence=await Sequence.findOneAndUpdate(
        {_id:'employeeId'},
        [{$set:{value:{$add:[{$max:[{$ifNull:['$value',0]},currentMax]},1]}}}],
        {new:true,upsert:true,session}
      );
      const employeeId=`EMP-${String(sequence.value).padStart(4,'0')}`;
      const passwordHash=await bcrypt.hash(req.body.password,12);
      [created]=await User.create([{employeeId,fullName:req.body.fullName,email:req.body.email,passwordHash,role:req.body.role,department:req.body.department}],{session});
      const {passwordHash:_passwordHash,...newState}=created.toObject();
      await AuditLog.create([{entityType:'USER',entityId:created._id,action:'USER_CREATED',performedBy:req.auth!.userId,previousState:null,newState,ipAddress:req.ip}],{session});
    });
    const user=await User.findById(created!._id).select('-passwordHash');
    res.status(201).json(user);
  }catch(error:any){
    const duplicate=error.code===11000;
    res.status(duplicate?409:error.status||500).json({error:duplicate?'Employee ID or email already exists':error.message||'Unable to create staff member'});
  }finally{await session.endSession();}
});

app.patch('/api/users/:id',authenticate,authorize('IT_ADMIN'),validate(z.object({body:z.object({
  employeeId:z.string().trim().min(1).optional(),fullName:z.string().trim().min(1).optional(),email:z.string().trim().email().optional(),
  password:z.string().min(8).optional(),role:z.enum(['IT_ADMIN','ASSET_MANAGER','EMPLOYEE']).optional(),
  department:z.string().trim().min(1).optional(),isActive:z.boolean().optional()
}).refine(value=>Object.keys(value).length>0)})),async(req,res)=>{
  const session=await mongoose.startSession();
  let updatedId:string|undefined;
  try{
    await session.withTransaction(async()=>{
      const user=await User.findById(req.params.id).session(session);
      if(!user)throw Object.assign(new Error('Staff member not found'),{status:404});
      const {passwordHash:_oldPasswordHash,...previousState}=user.toObject();
      const {password,...changes}=req.body;
      if(password)user.passwordHash=await bcrypt.hash(password,12);
      user.set(changes);
      await user.save({session});
      const {passwordHash:_newPasswordHash,...newState}=user.toObject();
      await AuditLog.create([{entityType:'USER',entityId:user._id,action:'USER_UPDATED',performedBy:req.auth!.userId,previousState,newState,ipAddress:req.ip}],{session});
      updatedId=user.id;
    });
    res.json(await User.findById(updatedId).select('-passwordHash'));
  }catch(error:any){res.status(error.status||500).json({error:error.message||'Unable to update staff member'});}finally{await session.endSession();}
});

app.delete('/api/users/:id',authenticate,authorize('IT_ADMIN'),async(req,res)=>{
  const session=await mongoose.startSession();
  try{
    await session.withTransaction(async()=>{
      const user=await User.findById(req.params.id).session(session);
      if(!user)throw Object.assign(new Error('Staff member not found'),{status:404});
      if(user.id===req.auth!.userId)throw Object.assign(new Error('You cannot deactivate your own account'),{status:400});
      const {passwordHash:_oldPasswordHash,...previousState}=user.toObject();
      user.isActive=false;
      await user.save({session});
      const {passwordHash:_newPasswordHash,...newState}=user.toObject();
      await AuditLog.create([{entityType:'USER',entityId:user._id,action:'USER_DEACTIVATED',performedBy:req.auth!.userId,previousState,newState,ipAddress:req.ip}],{session});
    });
    res.status(204).send();
  }catch(error:any){res.status(error.status||500).json({error:error.message||'Unable to deactivate staff member'});}finally{await session.endSession();}
});

app.get('/api/dashboard/metrics', authenticate, async (_req,res)=>{
  const now=new Date(), d30=new Date(now); d30.setDate(d30.getDate()+30);
  const d60=new Date(now); d60.setDate(d60.getDate()+60);
  const d90=new Date(now); d90.setDate(d90.getDate()+90);
  const [counts,totalDevices,openMaintenance,totalValue,warranty30,warranty60,warranty90,warrantyAlerts,byCategory] = await Promise.all([
    Device.aggregate([{$group:{_id:'$status',count:{$sum:1}}}]),Device.countDocuments(),
    MaintenanceLog.countDocuments({status:{$in:['OPEN','IN_PROGRESS','AWAITING_PARTS']}}),
    Device.aggregate([{$group:{_id:null,total:{$sum:'$financials.purchaseCost'}}}]),
    Device.countDocuments({'financials.warrantyExpiryDate':{$gte:now,$lte:d30}}),
    Device.countDocuments({'financials.warrantyExpiryDate':{$gte:now,$lte:d60}}),
    Device.countDocuments({'financials.warrantyExpiryDate':{$gte:now,$lte:d90}}),
    Device.find({'financials.warrantyExpiryDate':{$gte:now,$lte:d90}}).sort({'financials.warrantyExpiryDate':1}).limit(10),
    Device.aggregate([{$group:{_id:'$category',count:{$sum:1}}}])
  ]);
  const byStatus=Object.fromEntries(counts.map((x:{_id:string,count:number})=>[x._id,x.count]));
  res.json({totalDevices,byStatus,byCategory,warrantyExpiring30:warranty30,warrantyExpiring60:warranty60,warrantyExpiring90:warranty90,warrantyAlerts,openMaintenance,totalAssetValuation:totalValue[0]?.total||0});
});

app.get('/api/devices',authenticate,validate(z.object({query:z.object({}).passthrough()})),async(req,res)=>{
  const {status,category,q,page='1',limit='25'}=req.query as any;
  const filter:any={};
  if(status)filter.status=status;if(category)filter.category=category;
  if(q)filter.$text={$search:String(q)};
  const p=Math.max(1,+page),l=Math.min(100,+limit);
  const [items,total]=await Promise.all([Device.find(filter).populate('currentAssignee','fullName department').sort({createdAt:-1}).skip((p-1)*l).limit(l),Device.countDocuments(filter)]);
  res.json({items,total,page:p,pages:Math.ceil(total/l)});
});
app.post('/api/devices',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),validate(z.object({body:z.record(z.unknown())})),async(req,res)=>{
  const session=await mongoose.startSession();let device;
  try{await session.withTransaction(async()=>{
    const {assignedTo,conditionOnIssue='GOOD',...deviceInput}=req.body;
    if(deviceInput.status==='PROVISIONED'&&!assignedTo)throw Object.assign(new Error('Select a staff member to provision this device'),{status:400});
    if(assignedTo){
      const assignee=await User.findOne({_id:assignedTo,isActive:true}).session(session);
      if(!assignee)throw Object.assign(new Error('Selected staff member was not found or is inactive'),{status:400});
      deviceInput.status='PROVISIONED';
      deviceInput.currentAssignee=assignee._id;
    }
    [device]=await Device.create([deviceInput],{session});
    if(assignedTo){
      const [assignment]=await Assignment.create([{device:device._id,assignedTo,assignedBy:req.auth!.userId,conditionOnIssue,assignedAt:new Date()}],{session});
      await recordAudit({entityType:'ASSIGNMENT',entityId:assignment._id,action:'ASSIGNMENT_CREATED',performedBy:req.auth!.userId,previousState:null,newState:assignment.toObject(),ipAddress:req.ip},session);
    }
    await AuditLog.create([{entityType:'DEVICE',entityId:device._id,action:assignedTo?'DEVICE_PROVISIONED':'DEVICE_CREATED',performedBy:req.auth!.userId,previousState:null,newState:device.toObject(),ipAddress:req.ip}],{session});
  });res.status(201).json(device);}catch(error:any){res.status(error.status||500).json({error:error.message||'Unable to create device'});}finally{await session.endSession();}
});
app.get('/api/devices/:id',authenticate,async(req,res)=>{const device=await Device.findById(req.params.id).populate('currentAssignee','fullName department email');if(!device)return res.status(404).json({error:'Device not found'});res.json(device);});
app.patch('/api/devices/:id',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),async(req,res)=>{
  const session=await mongoose.startSession();
  try{
    let updatedId:string|undefined;
    await session.withTransaction(async()=>{
      const device=await Device.findById(req.params.id).session(session);
      if(!device)throw Object.assign(new Error('Device not found'),{status:404});
      const previousState=device.toObject();
      device.set(req.body);
      await device.save({session});
      await recordAudit({entityType:'DEVICE',entityId:device._id,action:'DEVICE_UPDATED',performedBy:req.auth!.userId,previousState,newState:device.toObject(),ipAddress:req.ip},session);
      updatedId=device.id;
    });
    res.json(await Device.findById(updatedId));
  }catch(error:any){res.status(error.status||500).json({error:error.message||'Unable to update device'});}finally{await session.endSession();}
});

async function nextMaintenanceTicketNumber(session?:mongoose.ClientSession):Promise<string>{
  const year=new Date().getFullYear();
  const highestTicketQuery=MaintenanceLog.aggregate([
    {$match:{ticketNumber:{$regex:`^MNT-${year}-\\d+$`}}},
    {$project:{numericId:{$toInt:{$arrayElemAt:[{$split:['$ticketNumber','-']},2]}}}},
    {$sort:{numericId:-1}},
    {$limit:1}
  ]);
  if(session)highestTicketQuery.session(session);
  const [highestTicket]=await highestTicketQuery;
  const currentMax=Number(highestTicket?.numericId??0);
  const sequence=await Sequence.findOneAndUpdate(
    {_id:`maintenanceTicket-${year}`},
    [{$set:{value:{$add:[{$max:[{$ifNull:['$value',0]},currentMax]},1]}}}],
    {new:true,upsert:true,...(session?{session}:{})}
  );
  return `MNT-${year}-${String(sequence.value).padStart(4,'0')}`;
}

async function closeActiveAssignments(
  deviceId:mongoose.Types.ObjectId,
  performedBy:string,
  ipAddress:string|undefined,
  session:mongoose.ClientSession,
  conditionOnReturn?:'GOOD'|'FAIR'|'DAMAGED'|'LOST'
):Promise<void>{
  const assignments=await Assignment.find({device:deviceId,returnedAt:null}).session(session);
  for(const assignment of assignments){
    const previousState=assignment.toObject();
    assignment.returnedAt=new Date();
    if(conditionOnReturn)assignment.conditionOnReturn=conditionOnReturn;
    await assignment.save({session});
    await recordAudit({entityType:'ASSIGNMENT',entityId:assignment._id,action:'ASSIGNMENT_RETURNED',performedBy,previousState,newState:assignment.toObject(),ipAddress},session);
  }
}

app.post('/api/devices/:id/transition',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),async(req,res)=>{
  const {to,assignedTo,conditionOnIssue='GOOD',maintenanceType='HARDWARE_REPAIR',description='Lifecycle maintenance',scheduledDate,reason,certificateOfDestructionUrl}=req.body;
  const session=await mongoose.startSession();
  try{
    let result;
    await session.withTransaction(async()=>{
      const device=await Device.findById(req.params.id).session(session);
      if(!device)throw Object.assign(new Error('Device not found'),{status:409});
      const from=device.status;
      const allowed=(from==='PROCURED'&&to==='PROVISIONED')||(from==='PROVISIONED'&&['MAINTENANCE','PROCURED','DECOMMISSIONED'].includes(to))||(from==='MAINTENANCE'&&['PROVISIONED','PROCURED','DECOMMISSIONED'].includes(to))||(to==='DECOMMISSIONED'&&from!=='DECOMMISSIONED');
      if(!allowed)throw Object.assign(new Error(`Invalid transition ${from} -> ${to}`),{status:409});
      if(to==='DECOMMISSIONED'&&device.category==='SERVER'&&req.auth!.role==='ASSET_MANAGER') {
        throw Object.assign(new Error('High-value servers require IT_ADMIN approval'),{status:403});
      }
      const snapshot=device.toObject();
      if(to==='DECOMMISSIONED'&&!reason)throw Object.assign(new Error('decommissionReason is required'),{status:400});
      if(to==='PROVISIONED'&&from!=='MAINTENANCE'){
        if(!assignedTo)throw Object.assign(new Error('assignedTo is required'),{status:400});
        const [assignment]=await Assignment.create([{device:device._id,assignedTo,assignedBy:req.auth!.userId,conditionOnIssue,assignedAt:new Date()}],{session});
        await recordAudit({entityType:'ASSIGNMENT',entityId:assignment._id,action:'ASSIGNMENT_CREATED',performedBy:req.auth!.userId,previousState:null,newState:assignment.toObject(),ipAddress:req.ip},session);
        device.currentAssignee=assignedTo;
      }
      if(from==='PROVISIONED'&&to==='PROCURED'){
        await closeActiveAssignments(device._id,req.auth!.userId,req.ip,session,'GOOD');
        device.currentAssignee=null;
      }
      if(to==='MAINTENANCE'){
        const [ticket]=await MaintenanceLog.create([{ticketNumber:await nextMaintenanceTicketNumber(session),device:device._id,reportedBy:req.auth!.userId,type:maintenanceType,description,scheduledDate:scheduledDate?new Date(scheduledDate):new Date(),status:'OPEN'}],{session});
        await recordAudit({entityType:'MAINTENANCE',entityId:ticket._id,action:'MAINTENANCE_CREATED',performedBy:req.auth!.userId,previousState:null,newState:ticket.toObject(),ipAddress:req.ip},session);
        await closeActiveAssignments(device._id,req.auth!.userId,req.ip,session);
        device.currentAssignee=null;
      }
      if(from==='MAINTENANCE'&&['PROVISIONED','PROCURED'].includes(to)){
        const tickets=await MaintenanceLog.find({device:device._id,status:{$ne:'COMPLETED'}}).session(session);
        for(const ticket of tickets){
          const previousState=ticket.toObject();
          ticket.status='COMPLETED';
          ticket.completedDate=new Date();
          ticket.resolutionNotes='Lifecycle transition resolved maintenance';
          await ticket.save({session});
          await recordAudit({entityType:'MAINTENANCE',entityId:ticket._id,action:'MAINTENANCE_COMPLETED',performedBy:req.auth!.userId,previousState,newState:ticket.toObject(),ipAddress:req.ip},session);
        }
        if(to==='PROVISIONED'){
          if(!assignedTo)throw Object.assign(new Error('assignedTo is required'),{status:400});
          const [assignment]=await Assignment.create([{device:device._id,assignedTo,assignedBy:req.auth!.userId,conditionOnIssue,assignedAt:new Date()}],{session});
          await recordAudit({entityType:'ASSIGNMENT',entityId:assignment._id,action:'ASSIGNMENT_CREATED',performedBy:req.auth!.userId,previousState:null,newState:assignment.toObject(),ipAddress:req.ip},session);
          device.currentAssignee=assignedTo;
        }
      }
      if(to==='DECOMMISSIONED'){
        await closeActiveAssignments(device._id,req.auth!.userId,req.ip,session,'LOST');
        device.currentAssignee=null;
        device.decommissionDetails={decommissionedAt:new Date(),reason,certificateOfDestructionUrl};
      }
      device.status=to;
      await device.save({session});
      await AuditLog.create([{entityType:'DEVICE',entityId:device._id,action:'STATUS_TRANSITION',performedBy:req.auth!.userId,previousState:snapshot,newState:device.toObject(),ipAddress:req.ip}],{session});
      result=device;
    });
    res.json(result);
  }catch(error:any){res.status(error.status||500).json({error:error.message||'Transition failed'});}finally{await session.endSession();}
});

app.get('/api/assignments',authenticate,async(req,res)=>{
  const filter:any=req.auth!.role==='EMPLOYEE'?{assignedTo:req.auth!.userId}:{};
  res.json(await Assignment.find(filter).populate('device','assetTag modelName category').populate('assignedTo','fullName department').sort({assignedAt:-1}).limit(100));
});
app.post('/api/assignments',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),async(req,res)=>{
  const session=await mongoose.startSession();
  try{
    let createdId:string|undefined;
    await session.withTransaction(async()=>{
      const [assignment]=await Assignment.create([req.body],{session});
      await recordAudit({entityType:'ASSIGNMENT',entityId:assignment._id,action:'ASSIGNMENT_CREATED',performedBy:req.auth!.userId,previousState:null,newState:assignment.toObject(),ipAddress:req.ip},session);
      createdId=assignment.id;
    });
    res.status(201).json(await Assignment.findById(createdId));
  }catch(error:any){res.status(error.status||500).json({error:error.message||'Unable to create assignment'});}finally{await session.endSession();}
});
app.patch('/api/assignments/:id/acknowledge',authenticate,async(req,res)=>{
  const session=await mongoose.startSession();
  try{
    let updatedId:string|undefined;
    await session.withTransaction(async()=>{
      const assignment=await Assignment.findById(req.params.id).session(session);
      if(!assignment||(req.auth!.role==='EMPLOYEE'&&assignment.assignedTo.toString()!==req.auth!.userId))throw Object.assign(new Error('Assignment not found'),{status:404});
      const previousState=assignment.toObject();
      assignment.acknowledgmentSigned=true;
      await assignment.save({session});
      await recordAudit({entityType:'ASSIGNMENT',entityId:assignment._id,action:'ASSIGNMENT_ACKNOWLEDGED',performedBy:req.auth!.userId,previousState,newState:assignment.toObject(),ipAddress:req.ip},session);
      updatedId=assignment.id;
    });
    res.json(await Assignment.findById(updatedId));
  }catch(error:any){res.status(error.status||500).json({error:error.message||'Unable to acknowledge assignment'});}finally{await session.endSession();}
});

const maintenanceTicketFields=z.object({
  device:z.string().regex(/^[a-f\d]{24}$/i),
  assignedTechnician:z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  type:z.enum(['PREVENTIVE','HARDWARE_REPAIR','OS_REIMAGE','WARRANTY_CLAIM','SECURITY_PATCH']),
  status:z.enum(['OPEN','IN_PROGRESS','AWAITING_PARTS','COMPLETED','CANCELLED']).optional(),
  description:z.string().trim().min(1),
  resolutionNotes:z.string().trim().optional(),
  cost:z.coerce.number().min(0).optional(),
  scheduledDate:z.coerce.date()
});

const populateMaintenanceTicket=(query:ReturnType<typeof MaintenanceLog.findById>)=>query
  .populate('device','assetTag serialNumber manufacturer modelName category status')
  .populate('reportedBy','fullName')
  .populate('assignedTechnician','fullName department');

app.get('/api/maintenance',authenticate,async(_req,res)=>{
  res.json(await MaintenanceLog.find().populate('device','assetTag modelName').populate('reportedBy','fullName').populate('assignedTechnician','fullName').sort({scheduledDate:-1}).limit(100));
});
app.get('/api/maintenance/:id',authenticate,async(req,res)=>{
  const ticket=await populateMaintenanceTicket(MaintenanceLog.findById(req.params.id));
  if(!ticket)return res.status(404).json({error:'Maintenance ticket not found'});
  res.json(ticket);
});
app.post('/api/maintenance',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),validate(z.object({body:maintenanceTicketFields})),async(req,res)=>{
  const session=await mongoose.startSession();
  try{
    let createdId:string|undefined;
    await session.withTransaction(async()=>{
      const {device,assignedTechnician,status,...fields}=req.body;
      if(!await Device.exists({_id:device}).session(session))throw Object.assign(new Error('Selected device was not found'),{status:400});
      if(assignedTechnician&&!await User.exists({_id:assignedTechnician,isActive:true}).session(session))throw Object.assign(new Error('Selected technician was not found or is inactive'),{status:400});
      const [ticket]=await MaintenanceLog.create([{
        ...fields,device,assignedTechnician:assignedTechnician||undefined,
        ticketNumber:await nextMaintenanceTicketNumber(session),
        reportedBy:req.auth!.userId,status:status??'OPEN',
        ...(status==='COMPLETED'?{completedDate:new Date()}:{})
      }],{session});
      await recordAudit({entityType:'MAINTENANCE',entityId:ticket._id,action:'MAINTENANCE_CREATED',performedBy:req.auth!.userId,previousState:null,newState:ticket.toObject(),ipAddress:req.ip},session);
      createdId=ticket.id;
    });
    res.status(201).json(await populateMaintenanceTicket(MaintenanceLog.findById(createdId)));
  }catch(error:any){
    res.status(error.code===11000?409:error.status||500).json({error:error.code===11000?'A ticket with this number already exists':error.message||'Unable to create maintenance ticket'});
  }finally{await session.endSession();}
});
app.patch('/api/maintenance/:id',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),validate(z.object({body:maintenanceTicketFields.partial().refine(value=>Object.keys(value).length>0)})),async(req,res)=>{
  const session=await mongoose.startSession();
  try{
    let updatedId:string|undefined;
    await session.withTransaction(async()=>{
      const ticket=await MaintenanceLog.findById(req.params.id).session(session);
      if(!ticket)throw Object.assign(new Error('Maintenance ticket not found'),{status:404});
      const previousState=ticket.toObject();
      const {device,assignedTechnician,...fields}=req.body;
      if(device&&!await Device.exists({_id:device}).session(session))throw Object.assign(new Error('Selected device was not found'),{status:400});
      if(assignedTechnician&&!await User.exists({_id:assignedTechnician,isActive:true}).session(session))throw Object.assign(new Error('Selected technician was not found or is inactive'),{status:400});
      ticket.set({...fields,...(device?{device}:{}),...(assignedTechnician!==undefined?{assignedTechnician:assignedTechnician||null}:{})});
      if(fields.status==='COMPLETED')ticket.completedDate??=new Date();
      else if(fields.status)ticket.completedDate=undefined;
      await ticket.save({session});
      const action=fields.status&&fields.status!==previousState.status?'MAINTENANCE_STATUS_UPDATED':'MAINTENANCE_UPDATED';
      await recordAudit({entityType:'MAINTENANCE',entityId:ticket._id,action,performedBy:req.auth!.userId,previousState,newState:ticket.toObject(),ipAddress:req.ip},session);
      updatedId=ticket.id;
    });
    res.json(await populateMaintenanceTicket(MaintenanceLog.findById(updatedId)));
  }catch(error:any){
    res.status(error.status||500).json({error:error.message||'Unable to update maintenance ticket'});
  }finally{await session.endSession();}
});
app.delete('/api/maintenance/:id',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),async(req,res)=>{
  const session=await mongoose.startSession();
  try{
    await session.withTransaction(async()=>{
      const ticket=await MaintenanceLog.findById(req.params.id).session(session);
      if(!ticket)throw Object.assign(new Error('Maintenance ticket not found'),{status:404});
      const previousState=ticket.toObject();
      await ticket.deleteOne({session});
      await recordAudit({entityType:'MAINTENANCE',entityId:ticket._id,action:'MAINTENANCE_DELETED',performedBy:req.auth!.userId,previousState,newState:null,ipAddress:req.ip},session);
    });
    res.status(204).send();
  }catch(error:any){res.status(error.status||500).json({error:error.message||'Unable to delete maintenance ticket'});}finally{await session.endSession();}
});

app.get('/api/audit-logs',authenticate,authorize('IT_ADMIN','ASSET_MANAGER'),async(req,res)=>{
  const {entityId,action,performedBy,from,to,page='1',limit='25'}=req.query as any;const filter:any={};
  if(entityId)filter.entityId=entityId;if(action)filter.action=action;if(performedBy)filter.performedBy=performedBy;
  if(from||to) {
    filter.timestamp = {};
    if(from) filter.timestamp.$gte = new Date(from);
    if(to) filter.timestamp.$lte = new Date(to);
  }
  const p=Math.max(1,+page),l=Math.min(100,+limit);const [items,total]=await Promise.all([AuditLog.find(filter).sort({timestamp:-1}).skip((p-1)*l).limit(l),AuditLog.countDocuments(filter)]);
  res.json({items,total,page:p,pages:Math.ceil(total/l)});
});

app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(error.status||500).json({error:error.message||'Internal server error'}));

async function start(){const uri=process.env.MONGODB_URI;if(!uri)throw new Error('MONGODB_URI is required');getJwtSecret();await mongoose.connect(uri);const port=Number(process.env.PORT||5000);app.listen(port,()=>console.log(`DevicePulse API listening on ${port}`));}
start().catch(error=>{console.error(error);process.exit(1);});
