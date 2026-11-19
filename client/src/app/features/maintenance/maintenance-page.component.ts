import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';

type TicketType='PREVENTIVE'|'HARDWARE_REPAIR'|'OS_REIMAGE'|'WARRANTY_CLAIM'|'SECURITY_PATCH';
type TicketStatus='OPEN'|'IN_PROGRESS'|'AWAITING_PARTS'|'COMPLETED'|'CANCELLED';

interface DeviceOption {
  _id:string;assetTag:string;manufacturer:string;modelName:string;serialNumber?:string;category?:string;status?:string;
}
interface TechnicianOption { _id:string;fullName:string;department?:string; }
interface MaintenanceRow {
  _id:string;ticketNumber:string;type:TicketType;status:TicketStatus;description:string;
  scheduledDate:string;cost:number;device?:DeviceOption;reportedBy?:{fullName:string};
  assignedTechnician?:TechnicianOption;
}
interface MaintenanceTicket extends MaintenanceRow {
  resolutionNotes?:string;completedDate?:string;
}
interface MaintenanceForm {
  device:string;type:TicketType;description:string;scheduledDate:string;cost:number;
  assignedTechnician:string;resolutionNotes:string;
}

const emptyForm=():MaintenanceForm=>({
  device:'',type:'HARDWARE_REPAIR',description:'',scheduledDate:new Date().toISOString().slice(0,10),
  cost:0,assignedTechnician:'',resolutionNotes:''
});

@Component({
  standalone:true,
  imports:[CommonModule,DatePipe,CurrencyPipe,FormsModule],
  template:`
    <header class="page-heading"><div><p class="overline">SERVICE OPERATIONS</p><h1>Maintenance</h1><p class="subtitle">Monitor repair, preventive care, and service tickets across the fleet.</p></div><div class="heading-actions">@if(canManage()){<button class="primary-button" type="button" (click)="openCreate()">＋ Add ticket</button>}<div class="ticket-count"><strong>{{tickets().length}}</strong><span>tickets</span></div></div></header>
    @if(message()){<p class="notice success">{{message()}}</p>}
    @if(error()){<p class="notice error">{{error()}}</p>}
    @if(optionsError()){<p class="notice error">{{optionsError()}}</p>}
    <article class="panel"><div class="table-wrap"><table><thead><tr><th>TICKET</th><th>DEVICE</th><th>ISSUE</th><th>TYPE</th><th>TECHNICIAN</th><th>SCHEDULED</th><th>COST</th><th>STATUS</th>@if(canManage()){<th>ACTIONS</th>}</tr></thead><tbody>
      @for(ticket of tickets();track ticket._id){<tr><td><button class="ticket-link" type="button" (click)="showDetails(ticket._id)">{{ticket.ticketNumber}}</button></td><td><b>{{ticket.device?.assetTag ?? '—'}}</b><small>{{ticket.device?.modelName}}</small></td><td class="description">{{ticket.description}}</td><td>{{ticket.type.replace('_',' ')}}</td><td>{{ticket.assignedTechnician?.fullName ?? 'Unassigned'}}</td><td>{{ticket.scheduledDate | date:'MMM d, y'}}</td><td>{{ticket.cost | currency:'USD':'symbol':'1.0-0'}}</td><td><span class="status" [attr.data-status]="ticket.status">{{ticket.status.replace('_',' ')}}</span></td>@if(canManage()){<td><button type="button" class="manage-button" (click)="showDetails(ticket._id)">Manage</button></td>}</tr>}
      @if(!tickets().length&&!error()){<tr><td [attr.colspan]="canManage()?9:8" class="empty">No maintenance tickets to show.</td></tr>}
    </tbody></table></div></article>
    @if(selectedTicketId()){
      <div class="modal-backdrop" role="presentation" (click)="closeDetails()">
        <section class="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-title" (click)="$event.stopPropagation()" (keydown.escape)="closeDetails()">
          <header class="modal-heading"><div><p class="overline">MAINTENANCE TICKET</p><h2 id="ticket-title">{{ticketDetails()?.ticketNumber ?? 'Loading ticket…'}}</h2></div><button class="close-button" type="button" aria-label="Close ticket details" (click)="closeDetails()">×</button></header>
          @if(detailLoading()){<p class="modal-message">Loading ticket details…</p>}
          @if(detailError()){<p class="notice error">{{detailError()}}</p>}
          @if(ticketDetails();as ticket){
            <div class="detail-summary"><div><strong>{{ticket.device?.assetTag ?? 'Device unavailable'}}</strong><span>{{ticket.device?.manufacturer}} {{ticket.device?.modelName}} · {{ticket.device?.serialNumber ?? '—'}}</span></div><span class="status" [attr.data-status]="ticket.status">{{ticket.status.replace('_',' ')}}</span></div>
            <div class="detail-grid">
              <article><h3>Ticket</h3><dl><dt>Type</dt><dd>{{ticket.type.replace('_',' ')}}</dd><dt>Scheduled</dt><dd>{{ticket.scheduledDate | date:'mediumDate'}}</dd><dt>Cost</dt><dd>{{ticket.cost | currency:'USD':'symbol':'1.0-0'}}</dd><dt>Reported by</dt><dd>{{ticket.reportedBy?.fullName ?? '—'}}</dd><dt>Technician</dt><dd>{{ticket.assignedTechnician?.fullName ?? 'Unassigned'}}</dd></dl></article>
              <article><h3>Device</h3><dl><dt>Category</dt><dd>{{ticket.device?.category?.replace('_',' ') ?? '—'}}</dd><dt>Device status</dt><dd>{{ticket.device?.status?.replace('_',' ') ?? '—'}}</dd><dt>Serial number</dt><dd>{{ticket.device?.serialNumber ?? '—'}}</dd></dl></article>
            </div>
            <section class="ticket-notes"><h3>Description</h3><p>{{ticket.description}}</p></section>
            @if(ticket.resolutionNotes){<section class="ticket-notes"><h3>Resolution notes</h3><p>{{ticket.resolutionNotes}}</p></section>}
            @if(ticket.completedDate){<p class="completed-date">Completed {{ticket.completedDate | date:'mediumDate'}}</p>}
            @if(canManage()){
              <section class="status-editor"><label for="ticket-status">Ticket status</label><div><select id="ticket-status" name="ticketStatus" [(ngModel)]="statusDraft">@for(status of statuses;track status){<option [value]="status">{{status.replace('_',' ')}}</option>}</select><button class="primary-button" type="button" [disabled]="updatingStatus()||statusDraft===ticket.status" (click)="updateStatus()">{{updatingStatus()?'Updating…':'Update status'}}</button></div></section>
            }
          }
          <footer class="modal-footer">@if(canManage()&&ticketDetails()){<div><button type="button" class="text-button danger" (click)="deleteTicket()">Delete</button><button type="button" class="secondary-button" (click)="openEdit()">Edit ticket</button></div>}<button type="button" class="secondary-button" (click)="closeDetails()">Close</button></footer>
        </section>
      </div>
    }
    @if(formOpen()){
      <div class="modal-backdrop" role="presentation" (click)="closeForm()">
        <section class="ticket-modal form-modal" role="dialog" aria-modal="true" aria-labelledby="form-title" (click)="$event.stopPropagation()" (keydown.escape)="closeForm()">
          <header class="modal-heading"><div><p class="overline">SERVICE OPERATIONS</p><h2 id="form-title">{{editingId()?'Edit ticket':'Create maintenance ticket'}}</h2></div><button class="close-button" type="button" aria-label="Close ticket form" (click)="closeForm()">×</button></header>
          <form class="ticket-form" (ngSubmit)="saveTicket()">
            <label>Device<select name="device" [(ngModel)]="form.device" required><option value="" disabled>Select a device</option>@for(device of devices();track device._id){<option [value]="device._id">{{device.assetTag}} — {{device.manufacturer}} {{device.modelName}}</option>}</select></label>
            <label>Ticket type<select name="type" [(ngModel)]="form.type" required>@for(type of types;track type){<option [value]="type">{{type.replace('_',' ')}}</option>}</select></label>
            <label>Scheduled date<input name="scheduledDate" type="date" [(ngModel)]="form.scheduledDate" required></label>
            <label>Assigned technician<select name="assignedTechnician" [(ngModel)]="form.assignedTechnician"><option value="">Unassigned</option>@for(person of technicians();track person._id){<option [value]="person._id">{{person.fullName}}</option>}</select></label>
            <label>Estimated cost<input name="cost" type="number" min="0" step="0.01" [(ngModel)]="form.cost" required></label>
            <label class="wide">Description<textarea name="description" rows="3" [(ngModel)]="form.description" required></textarea></label>
            <label class="wide">Resolution notes<textarea name="resolutionNotes" rows="3" [(ngModel)]="form.resolutionNotes"></textarea></label>
            @if(formError()){<p class="notice error wide">{{formError()}}</p>}
            <footer class="form-actions"><button type="button" class="secondary-button" (click)="closeForm()">Cancel</button><button class="primary-button" type="submit" [disabled]="saving()||!devices().length">{{saving()?'Saving…':editingId()?'Save changes':'Create ticket'}}</button></footer>
          </form>
        </section>
      </div>
    }
  `,
  styles:[`
    :host{display:block}.page-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.heading-actions{display:flex;align-items:center;gap:12px}.overline{font-size:10px;letter-spacing:1.4px;font-weight:700;color:#4180bb;margin:0 0 7px}.page-heading h1{font-size:25px;margin:0;color:#172b44}.subtitle{font-size:13px;color:#7d8da3;margin:7px 0 0}.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#2468a8;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 13px;border:0;border-radius:7px;cursor:pointer}.primary-button:hover{background:#18578f}.primary-button:disabled{opacity:.55;cursor:default}.ticket-count{padding:9px 14px;background:#fff;border:1px solid #e9eef4;border-radius:8px;text-align:center}.ticket-count strong,.ticket-count span{display:block}.ticket-count strong{font-size:18px}.ticket-count span{font-size:10px;color:#8998a9}.panel{background:#fff;border:1px solid #e9eef4;border-radius:10px;padding:18px;box-shadow:0 3px 14px #1b365008}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:11px;white-space:nowrap}th{font-size:9px;letter-spacing:.8px;color:#8796a8;padding:11px 9px;border-bottom:1px solid #e9eef4}td{padding:12px 9px;border-bottom:1px solid #f0f3f6;color:#4e6279}td b,td small{display:block}td b{color:#273c55}td small{font-size:10px;color:#96a3b2;margin-top:4px}.ticket-link,.text-button{padding:0;border:0;background:none;color:#3479b7;font:inherit;font-weight:700;cursor:pointer}.ticket-link:hover,.text-button:hover{text-decoration:underline}.description{max-width:230px;white-space:normal}.manage-button{border:1px solid #d7e4f0;border-radius:5px;background:#f4f8fc;padding:6px 9px;color:#3479b7;font-size:10px;font-weight:700;cursor:pointer}.manage-button:hover{background:#e8f2fb}.status{border-radius:12px;padding:4px 8px;font-size:9px;font-weight:700;background:#e8f0fd;color:#3866a4}.status[data-status="OPEN"]{background:#fff2dc;color:#94651f}.status[data-status="IN_PROGRESS"]{background:#e8f0fd;color:#3866a4}.status[data-status="AWAITING_PARTS"]{background:#f2eafd;color:#7149a0}.status[data-status="COMPLETED"]{background:#e2f5e9;color:#28734a}.status[data-status="CANCELLED"]{background:#edf0f3;color:#697786}.empty{text-align:center;color:#91a0b0;padding:28px}.notice{padding:10px 12px;border-radius:7px;font-size:12px}.notice.error{background:#fff0ee;color:#a4362a}.notice.success{background:#e5f5ec;color:#28734a}
    .modal-backdrop{position:fixed;inset:0;z-index:25;background:#0d1d30a8;display:grid;place-items:center;padding:20px}.ticket-modal{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 20px 70px #08182b66;padding:22px}.modal-heading{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #edf1f5;padding-bottom:14px}.modal-heading h2{font-size:20px;margin:5px 0;color:#172b44}.close-button{border:0;background:#f1f4f8;border-radius:50%;width:30px;height:30px;font-size:22px;line-height:1;color:#586b80;cursor:pointer}.detail-summary{display:flex;align-items:center;justify-content:space-between;padding:18px 0;border-bottom:1px solid #edf1f5}.detail-summary strong,.detail-summary span:not(.status){display:block}.detail-summary strong{font-size:15px;color:#2d435b}.detail-summary span:not(.status){font-size:11px;color:#8796a8;margin-top:5px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 0}.detail-grid article,.ticket-notes{background:#f7f9fc;padding:14px;border-radius:8px}.detail-grid h3,.ticket-notes h3{margin:0 0 11px;font-size:12px;color:#344b64}.detail-grid dl{display:grid;grid-template-columns:1fr 1.2fr;gap:8px;margin:0;font-size:11px}.detail-grid dt{color:#8593a4}.detail-grid dd{margin:0;color:#3e536b;text-align:right}.ticket-notes{margin:10px 0}.ticket-notes p{margin:0;color:#4e6279;font-size:12px;white-space:pre-wrap}.completed-date,.modal-message{font-size:12px;color:#72839a}.status-editor{display:grid;gap:8px;padding:14px 0;border-top:1px solid #edf1f5}.status-editor label{font-size:11px;font-weight:700;color:#425870}.status-editor>div{display:flex;gap:9px}.status-editor select,.ticket-form input,.ticket-form select,.ticket-form textarea{min-width:0;border:1px solid #dfe6ee;border-radius:6px;padding:9px;color:#344b64;font:inherit;background:#fff}.status-editor select{flex:1}.modal-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #edf1f5;padding-top:14px;margin-top:14px}.modal-footer>div{display:flex;align-items:center;gap:14px}.text-button.danger{color:#ad4237}.secondary-button{border:1px solid #dfe6ee;background:#fff;border-radius:6px;padding:9px 13px;color:#40546c;cursor:pointer}.form-modal{width:min(640px,100%)}.ticket-form{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-top:18px}.ticket-form label{display:grid;gap:6px;color:#425870;font-size:11px;font-weight:600}.ticket-form textarea{resize:vertical}.ticket-form .wide,.form-actions{grid-column:1/-1}.form-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:4px}.modal-message{padding:16px 0}
    @media(max-width:600px){.page-heading{align-items:flex-start;gap:10px}.page-heading h1{font-size:21px}.heading-actions{align-items:flex-end;flex-direction:column;gap:8px}.ticket-modal{padding:16px}.detail-grid,.ticket-form{grid-template-columns:1fr}.ticket-form .wide,.form-actions{grid-column:1}.status-editor>div{align-items:stretch;flex-direction:column}.detail-grid dl{grid-template-columns:1fr 1fr}}
  `]
})
export class MaintenancePageComponent implements OnInit{
  readonly types:TicketType[]=['PREVENTIVE','HARDWARE_REPAIR','OS_REIMAGE','WARRANTY_CLAIM','SECURITY_PATCH'];
  readonly statuses:TicketStatus[]=['OPEN','IN_PROGRESS','AWAITING_PARTS','COMPLETED','CANCELLED'];
  readonly tickets=signal<MaintenanceRow[]>([]);
  readonly devices=signal<DeviceOption[]>([]);
  readonly technicians=signal<TechnicianOption[]>([]);
  readonly error=signal('');
  readonly optionsError=signal('');
  readonly message=signal('');
  readonly selectedTicketId=signal<string|null>(null);
  readonly ticketDetails=signal<MaintenanceTicket|null>(null);
  readonly detailLoading=signal(false);
  readonly detailError=signal('');
  readonly updatingStatus=signal(false);
  readonly formOpen=signal(false);
  readonly editingId=signal<string|null>(null);
  readonly saving=signal(false);
  readonly formError=signal('');
  form=emptyForm();
  statusDraft:TicketStatus='OPEN';

  constructor(private http:HttpClient,private auth:AuthService){}

  canManage():boolean{
    const role=this.auth.user()?.role;
    return role!=='EMPLOYEE';
  }

  ngOnInit():void{
    this.loadTickets();
    if(this.canManage())this.loadFormOptions();
  }

  loadTickets():void{
    this.error.set('');
    this.http.get<MaintenanceRow[]>(`${environment.apiUrl}/api/maintenance`).subscribe({
      next:rows=>{
        this.tickets.set(rows);
      },
      error:()=>this.error.set('Could not load maintenance tickets. Please try again.')
    });
  }

  loadFormOptions():void{
    this.http.get<{items:DeviceOption[]}>(`${environment.apiUrl}/api/devices`,{params:{limit:'100'}}).subscribe({
      next:result=>this.devices.set(result.items),
      error:()=>this.optionsError.set('Could not load devices for the ticket form.')
    });
    this.http.get<{items:TechnicianOption[]}>(`${environment.apiUrl}/api/users`,{params:{active:'true',department:'IT Operations',limit:'100'}}).subscribe({
      next:result=>this.technicians.set(result.items),
      error:()=>this.optionsError.set('Could not load technicians for the ticket form.')
    });
  }

  showDetails(id:string):void{
    this.selectedTicketId.set(id);
    this.ticketDetails.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.http.get<MaintenanceTicket>(`${environment.apiUrl}/api/maintenance/${id}`).subscribe({
      next:ticket=>{this.ticketDetails.set(ticket);this.statusDraft=ticket.status;},
      error:()=>{this.detailError.set('Unable to load maintenance ticket details.');this.detailLoading.set(false);},
      complete:()=>this.detailLoading.set(false)
    });
  }

  closeDetails():void{
    this.selectedTicketId.set(null);
    this.ticketDetails.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
  }

  openCreate():void{
    this.editingId.set(null);
    this.form=emptyForm();
    this.formError.set('');
    this.formOpen.set(true);
  }

  openEdit():void{
    const ticket=this.ticketDetails();
    if(!ticket)return;
    this.editingId.set(ticket._id);
    this.form={
      device:ticket.device?._id??'',type:ticket.type,description:ticket.description,
      scheduledDate:new Date(ticket.scheduledDate).toISOString().slice(0,10),cost:ticket.cost??0,
      assignedTechnician:ticket.assignedTechnician?._id??'',resolutionNotes:ticket.resolutionNotes??''
    };
    this.formError.set('');
    this.closeDetails();
    this.formOpen.set(true);
  }

  closeForm():void{this.formOpen.set(false);}

  saveTicket():void{
    this.saving.set(true);
    this.formError.set('');
    const payload={...this.form,assignedTechnician:this.form.assignedTechnician||null,cost:Number(this.form.cost)};
    const request=this.editingId()
      ?this.http.patch<MaintenanceTicket>(`${environment.apiUrl}/api/maintenance/${this.editingId()}`,payload)
      :this.http.post<MaintenanceTicket>(`${environment.apiUrl}/api/maintenance`,payload);
    request.subscribe({
      next:ticket=>{
        this.message.set(this.editingId()?`${ticket.ticketNumber} was updated.`:`${ticket.ticketNumber} was created.`);
        this.closeForm();
        this.loadTickets();
      },
      error:(error:{error?:{error?:string}})=>{
        this.formError.set(error.error?.error??'Unable to save the maintenance ticket.');
        this.saving.set(false);
      },
      complete:()=>this.saving.set(false)
    });
  }

  updateStatus():void{
    const ticket=this.ticketDetails();
    if(!ticket)return;
    this.updatingStatus.set(true);
    this.detailError.set('');
    this.http.patch<MaintenanceTicket>(`${environment.apiUrl}/api/maintenance/${ticket._id}`,{status:this.statusDraft}).subscribe({
      next:updated=>{
        this.ticketDetails.set(updated);
        this.statusDraft=updated.status;
        this.message.set(`${updated.ticketNumber} status updated.`);
        this.loadTickets();
      },
      error:(error:{error?:{error?:string}})=>{
        this.detailError.set(error.error?.error??'Unable to update ticket status.');
        this.updatingStatus.set(false);
      },
      complete:()=>this.updatingStatus.set(false)
    });
  }

  deleteTicket():void{
    const ticket=this.ticketDetails();
    if(!ticket||!window.confirm(`Delete ${ticket.ticketNumber}? This cannot be undone.`))return;
    this.http.delete(`${environment.apiUrl}/api/maintenance/${ticket._id}`).subscribe({
      next:()=>{
        this.message.set(`${ticket.ticketNumber} was deleted.`);
        this.closeDetails();
        this.loadTickets();
      },
      error:(error:{error?:{error?:string}})=>this.detailError.set(error.error?.error??'Unable to delete the maintenance ticket.')
    });
  }
}
