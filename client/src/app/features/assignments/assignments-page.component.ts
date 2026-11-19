import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AssignmentRow {
  _id:string; assignedAt:string; returnedAt?:string; acknowledgmentSigned:boolean;
  assignedTo?:{fullName:string;department:string};
  device?:{_id:string;assetTag:string;modelName:string;category:string};
  conditionOnIssue:string;
}

interface DeviceDetails {
  _id:string; assetTag:string; serialNumber:string; manufacturer:string; modelName:string; category:string; status:string;
  currentAssignee?:{fullName:string;email:string;department:string};
  specs?:{cpu?:string;ramGb?:number;storageGb?:number;osVersion?:string};
  location?:{office?:string;floor?:string;deskOrRack?:string};
  financials?:{purchaseDate?:string;purchaseCost?:number;vendor?:string;warrantyExpiryDate?:string};
  decommissionDetails?:{reason?:string};
}

@Component({
  standalone:true,
  imports:[CommonModule,DatePipe],
  template:`
    <header class="page-heading"><div><p class="overline">CUSTODY TRACKING</p><h1>Assignments</h1><p class="subtitle">Review device assignments, custody status, and acknowledgments.</p></div></header>
    @if(error()){<p class="error">{{error()}}</p>}
    <article class="panel"><div class="table-wrap"><table><thead><tr><th>DEVICE</th><th>ASSIGNED TO</th><th>DEPARTMENT</th><th>ISSUED</th><th>CONDITION</th><th>RECEIPT</th><th>STATUS</th></tr></thead><tbody>
      @for(row of assignments();track row._id){<tr><td>@if(row.device){<button class="device-link" type="button" (click)="showDetails(row.device._id)">{{row.device.assetTag}}</button>}@else{<b>—</b>}<small>{{row.device?.modelName}}</small></td><td>{{row.assignedTo?.fullName ?? '—'}}</td><td>{{row.assignedTo?.department ?? '—'}}</td><td>{{row.assignedAt | date:'MMM d, y'}}</td><td>{{row.conditionOnIssue}}</td><td><span class="receipt" [class.signed]="row.acknowledgmentSigned">{{row.acknowledgmentSigned?'Acknowledged':'Pending'}}</span></td><td><span class="state">{{row.returnedAt?'Returned':'Active'}}</span></td></tr>}
      @if(!assignments().length&&!error()){<tr><td colspan="7" class="empty">No assignments to show.</td></tr>}
    </tbody></table></div><footer>{{assignments().length}} assignment records</footer></article>
    @if(selectedDeviceId()){
      <div class="modal-backdrop" role="presentation" (click)="closeDetails()">
        <section class="device-modal" role="dialog" aria-modal="true" aria-labelledby="device-title" (click)="$event.stopPropagation()" (keydown.escape)="closeDetails()">
          <header class="modal-heading"><div><p class="overline">DEVICE DETAILS</p><h2 id="device-title">{{deviceDetails()?.assetTag ?? 'Loading device…'}}</h2></div><button class="close-button" type="button" aria-label="Close device details" (click)="closeDetails()">×</button></header>
          @if(detailLoading()){<p class="modal-message">Loading device details…</p>}
          @if(detailError()){<p class="modal-error">{{detailError()}}</p>}
          @if(deviceDetails(); as device){
            <div class="detail-summary"><div><strong>{{device.manufacturer}} {{device.modelName}}</strong><span>{{device.serialNumber}}</span></div><span class="status" [attr.data-status]="device.status">{{device.status}}</span></div>
            <div class="detail-grid">
              <article><h3>Asset</h3><dl><dt>Category</dt><dd>{{device.category.replace('_',' ')}}</dd><dt>Assigned to</dt><dd>{{device.currentAssignee?.fullName ?? 'Unassigned'}}</dd><dt>Department</dt><dd>{{device.currentAssignee?.department ?? '—'}}</dd><dt>Email</dt><dd>{{device.currentAssignee?.email ?? '—'}}</dd></dl></article>
              <article><h3>Specifications</h3><dl><dt>Processor</dt><dd>{{device.specs?.cpu ?? '—'}}</dd><dt>Memory</dt><dd>{{device.specs?.ramGb ? device.specs?.ramGb + ' GB' : '—'}}</dd><dt>Storage</dt><dd>{{device.specs?.storageGb ? device.specs?.storageGb + ' GB' : '—'}}</dd><dt>Operating system</dt><dd>{{device.specs?.osVersion ?? '—'}}</dd></dl></article>
              <article><h3>Location</h3><dl><dt>Office</dt><dd>{{device.location?.office ?? '—'}}</dd><dt>Floor</dt><dd>{{device.location?.floor ?? '—'}}</dd><dt>Desk / rack</dt><dd>{{device.location?.deskOrRack ?? '—'}}</dd></dl></article>
              <article><h3>Financials & warranty</h3><dl><dt>Purchase date</dt><dd>{{device.financials?.purchaseDate | date:'mediumDate'}}</dd><dt>Purchase cost</dt><dd>{{device.financials?.purchaseCost ?? 0 | currency:'USD':'symbol':'1.0-0'}}</dd><dt>Vendor</dt><dd>{{device.financials?.vendor ?? '—'}}</dd><dt>Warranty expiry</dt><dd>{{device.financials?.warrantyExpiryDate | date:'mediumDate'}}</dd></dl></article>
            </div>
            @if(device.decommissionDetails?.reason){<p class="decommission-note"><b>Decommission reason:</b> {{device.decommissionDetails?.reason}}</p>}
          }
          <footer class="modal-footer"><button type="button" class="secondary-button" (click)="closeDetails()">Close</button></footer>
        </section>
      </div>
    }
  `,
  styles:[`
    :host{display:block}.page-heading{margin-bottom:24px}.overline{font-size:10px;letter-spacing:1.4px;font-weight:700;color:#4180bb;margin:0 0 7px}.page-heading h1{font-size:25px;margin:0;color:#172b44}.subtitle{font-size:13px;color:#7d8da3;margin:7px 0 0}.panel{background:#fff;border:1px solid #e9eef4;border-radius:10px;padding:18px;box-shadow:0 3px 14px #1b365008}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:12px;white-space:nowrap}th{font-size:9px;letter-spacing:.8px;color:#8796a8;padding:11px 10px;border-bottom:1px solid #e9eef4}td{padding:12px 10px;border-bottom:1px solid #f0f3f6;color:#4e6279}td b,td small{display:block}td b{color:#273c55}td small{font-size:10px;color:#96a3b2;margin-top:4px}.device-link{display:block;padding:0;border:0;background:none;color:#3479b7;font:inherit;font-weight:700;cursor:pointer}.device-link:hover{text-decoration:underline}.receipt,.state{font-size:10px;border-radius:12px;padding:4px 8px;background:#fff2dc;color:#94651f}.receipt.signed{background:#e2f5e9;color:#28734a}.state{background:#e8f0fd;color:#3866a4}.empty{text-align:center;color:#91a0b0;padding:28px}footer{font-size:11px;color:#8998a9;padding:14px 10px 0}.error{color:#a4362a;font-size:13px}
    .modal-backdrop{position:fixed;inset:0;z-index:20;background:#0d1d30a8;display:grid;place-items:center;padding:24px}.device-modal{width:min(760px,100%);max-height:min(90vh,850px);overflow:auto;background:#fff;border-radius:13px;box-shadow:0 20px 70px #08182b66;padding:24px}.modal-heading{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #edf1f5;padding-bottom:15px}.modal-heading h2{font-size:22px;margin:5px 0;color:#172b44}.close-button{border:0;background:#f1f4f8;border-radius:50%;width:32px;height:32px;font-size:22px;line-height:1;color:#586b80;cursor:pointer}.detail-summary{display:flex;align-items:center;justify-content:space-between;padding:18px 0;border-bottom:1px solid #edf1f5}.detail-summary strong,.detail-summary span:not(.status){display:block}.detail-summary strong{font-size:15px;color:#2d435b}.detail-summary span:not(.status){font-size:11px;color:#8796a8;margin-top:5px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 0}.detail-grid article{background:#f7f9fc;padding:14px;border-radius:8px}.detail-grid h3{margin:0 0 11px;font-size:12px;color:#344b64}.detail-grid dl{display:grid;grid-template-columns:1fr 1.2fr;gap:7px;margin:0;font-size:11px}.detail-grid dt{color:#8593a4}.detail-grid dd{margin:0;color:#3e536b;text-align:right}.modal-message,.modal-error{padding:20px 0;font-size:13px;color:#72839a}.modal-error{color:#a4362a}.decommission-note{padding:10px;background:#fff2dc;border-radius:6px;color:#72531e;font-size:12px}.modal-footer{display:flex;justify-content:flex-end;border-top:1px solid #edf1f5;padding-top:15px}.secondary-button{border:1px solid #dfe6ee;background:#fff;border-radius:6px;padding:9px 16px;color:#40546c;cursor:pointer}
    @media(max-width:560px){.modal-backdrop{padding:10px}.device-modal{padding:16px}.detail-grid{grid-template-columns:1fr}}
  `]
})
export class AssignmentsPageComponent implements OnInit {
  readonly assignments=signal<AssignmentRow[]>([]);
  readonly error=signal('');
  readonly selectedDeviceId=signal<string|null>(null);
  readonly deviceDetails=signal<DeviceDetails|null>(null);
  readonly detailLoading=signal(false);
  readonly detailError=signal('');
  constructor(private http:HttpClient){}
  ngOnInit():void{
    this.http.get<AssignmentRow[]>(`${environment.apiUrl}/api/assignments`).subscribe({
      next:rows=>this.assignments.set(rows),
      error:()=>this.error.set('Could not load assignments. Please try again.')
    });
  }

  showDetails(id:string):void{
    this.selectedDeviceId.set(id);
    this.deviceDetails.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.http.get<DeviceDetails>(`${environment.apiUrl}/api/devices/${id}`).subscribe({
      next:device=>this.deviceDetails.set(device),
      error:()=>{this.detailError.set('Unable to load details for this device.');this.detailLoading.set(false);},
      complete:()=>this.detailLoading.set(false)
    });
  }

  closeDetails():void{
    this.selectedDeviceId.set(null);
    this.deviceDetails.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
  }
}
