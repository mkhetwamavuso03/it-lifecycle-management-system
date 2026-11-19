import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Device, Assignment, MaintenanceLog, AuditLog } from './models';

export async function seedDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sampleUserPassword = process.env.SAMPLE_USER_PASSWORD;
  if (!adminEmail || !adminPassword || !sampleUserPassword) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD, and SAMPLE_USER_PASSWORD are required');
  }
  if (adminPassword.length < 12 || sampleUserPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD and SAMPLE_USER_PASSWORD must be at least 12 characters');
  }
  await mongoose.connect(uri);
  await Promise.all([User.deleteMany({}), Device.deleteMany({}), Assignment.deleteMany({}), MaintenanceLog.deleteMany({}), AuditLog.deleteMany({})]);

  const [adminPasswordHash, sampleUserPasswordHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(sampleUserPassword, 12)
  ]);
  const users = await User.create([
    { employeeId:'EMP-1001', fullName:'Avery Morgan', email:adminEmail, passwordHash:adminPasswordHash, role:'IT_ADMIN', department:'IT Operations' },
    { employeeId:'EMP-1002', fullName:'Jordan Lee', email:'assets@devicepulse.local', passwordHash:sampleUserPasswordHash, role:'ASSET_MANAGER', department:'Asset Management' },
    ...['Casey Kim','Morgan Patel','Taylor Silva','Riley Chen','Sam Wilson','Alex Johnson','Jamie Rivera','Drew Garcia','Quinn Brown','Skyler Davis','Robin Thomas','Parker Evans','Reese Moore','Cameron Clark','Hayden Lewis','Emerson Hall','Finley Young','Dakota Allen','Rowan Scott','Spencer King'].map((fullName,i)=>({
      employeeId:`EMP-${2001+i}`,fullName,email:`employee${i+1}@devicepulse.local`,passwordHash:sampleUserPasswordHash,role:'EMPLOYEE',department:['Engineering','Security','Finance','Marketing','Operations'][i%5]
    }))
  ]);
  const admin=users[0], manager=users[1];
  const categories=['LAPTOP','WORKSTATION','MOBILE','SERVER','NETWORK_GEAR','PERIPHERAL'] as const;
  const manufacturers=['Dell','Apple','Lenovo','Cisco','HP','Logitech'];
  const devices:any[]=[];
  for(let i=1;i<=30;i++){
    const status=i<=5?'PROCURED':i<=20?'PROVISIONED':i<=26?'MAINTENANCE':'DECOMMISSIONED';
    const days=Math.floor(Math.random()*120)-20;
    const warranty=new Date();warranty.setDate(warranty.getDate()+days);
    const category=categories[(i-1)%categories.length];
    devices.push({
      assetTag:`DP-${category.substring(0,3)}-${String(i).padStart(4,'0')}`,
      serialNumber:`SN-${2026}-${String(i).padStart(5,'0')}`,
      macAddress:`${i.toString(16).padStart(2,'0')}:8A:4C:11:22:${i.toString(16).padStart(2,'0')}`,
      category,manufacturer:manufacturers[(i-1)%manufacturers.length],
      modelName:`Enterprise ${category === 'SERVER' ? 'Rack Server R760' : category === 'MOBILE' ? 'Model Pro 15' : 'Latitude/ThinkPad M14'}`,
      specs:{cpu:'Intel Xeon / Core i7',ramGb:[16,32,64][i%3],storageGb:[512,1024,2048][i%3],osVersion:'Enterprise Linux / Windows 11'},
      status,location:{office:['New York','London','Johannesburg','Singapore'][i%4],floor:String(1+(i%8)),deskOrRack:`${i%2?'Desk':'Rack'}-${i}`},
      financials:{purchaseDate:new Date(2024,i%12,1+(i%28)),purchaseCost:700+(i*410),vendor:'Global IT Supply',warrantyExpiryDate:warranty},
      currentAssignee:status==='PROVISIONED'?users[2+(i%18)]._id:null,
      decommissionDetails:status==='DECOMMISSIONED'?{decommissionedAt:new Date(),reason:'End of useful lifecycle'}:undefined
    });
  }
  const createdDevices=await Device.create(devices);
  for(let i=0;i<createdDevices.length;i++){
    const device:any=createdDevices[i];
    if(device.status==='PROVISIONED'){
      await Assignment.create({device:device._id,assignedTo:device.currentAssignee,assignedBy:manager._id,assignedAt:new Date(2026,0,1+i),returnedAt:null,conditionOnIssue:'GOOD',acknowledgmentSigned:i%3===0});
    }
  }
  for(let i=0;i<8;i++){
    const device=createdDevices[5+(i%21)];
    await MaintenanceLog.create({ticketNumber:`MNT-2026-${String(i+1).padStart(4,'0')}`,device:device._id,reportedBy:users[2+(i%18)]._id,assignedTechnician:i%2?admin._id:manager._id,type:['PREVENTIVE','HARDWARE_REPAIR','SECURITY_PATCH','OS_REIMAGE'][i%4],status:['OPEN','IN_PROGRESS','AWAITING_PARTS','COMPLETED'][i%4],description:['Preventive battery inspection','Trackpad replacement','Security patch application','Operating system reimage'][i%4],resolutionNotes:i%4===3?'Service completed successfully':'',cost:i*125,scheduledDate:new Date(2026,10,20+i),completedDate:i%4===3?new Date():undefined});
  }
  await AuditLog.create(createdDevices.slice(0,15).map((device,i)=>({entityType:'DEVICE',entityId:device._id,action:i%3===0?'DEVICE_CREATED':'STATUS_TRANSITION',performedBy:i%2?admin._id:manager._id,previousState:i%3===0?null:{status:'PROCURED'},newState:{status:device.status},ipAddress:'127.0.0.1',timestamp:new Date(2026,10,1+i)})));
  console.log(`Seeded ${users.length} users, ${createdDevices.length} devices, and maintenance/audit records.`);
  await mongoose.disconnect();
}
