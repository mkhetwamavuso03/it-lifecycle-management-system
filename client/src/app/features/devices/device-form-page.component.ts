import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface StaffOption {
  _id:string;
  employeeId:string;
  fullName:string;
  email:string;
  department:string;
  role:string;
}

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <header class="page-heading"><div><p class="overline">ASSET MANAGEMENT</p><h1>Add a device</h1><p class="subtitle">Register a new asset in the device inventory.</p></div><a class="back-link" routerLink="/devices">← Back to devices</a></header>
    <form class="panel form-grid" (ngSubmit)="submit()">
      <label>Asset tag<input name="assetTag" [(ngModel)]="device.assetTag" placeholder="DP-LPT-00492" required></label>
      <label>Serial number<input name="serialNumber" [(ngModel)]="device.serialNumber" required></label>
      <label>Category<select name="category" [(ngModel)]="device.category"><option>LAPTOP</option><option>WORKSTATION</option><option>MOBILE</option><option>SERVER</option><option>NETWORK_GEAR</option><option>PERIPHERAL</option></select></label>
      <label>Manufacturer<input name="manufacturer" [(ngModel)]="device.manufacturer" placeholder="Dell" required></label>
      <label>Model name<input name="modelName" [(ngModel)]="device.modelName" placeholder="Latitude 7450" required></label>
      <label>MAC address <span class="optional">(optional)</span><input name="macAddress" [(ngModel)]="device.macAddress" placeholder="00:1A:2B:3C:4D:5E"></label>
      <label>Purchase cost<input name="purchaseCost" type="number" min="0" [(ngModel)]="device.purchaseCost"></label>
      <label>Warranty expiry<input name="warrantyExpiryDate" type="date" [(ngModel)]="device.warrantyExpiryDate"></label>
      <label class="assignment-field">Assign to staff member <span class="optional">(optional — leave empty to keep as procured)</span>
        <select name="assignedTo" [(ngModel)]="assignedTo"><option value="">Not assigned</option>@for (staffMember of staff(); track staffMember._id) { <option [value]="staffMember._id">{{staffMember.fullName}} · {{staffMember.department}}</option> }</select>
      </label>
      @if (staffError()) { <p class="error">{{staffError()}}</p> }
      @if (error) { <p class="error">{{error}}</p> }
      <div class="actions"><a class="cancel" routerLink="/devices">Cancel</a><button type="submit" [disabled]="saving">{{saving ? 'Saving…' : 'Save device'}}</button></div>
    </form>
  `,
  styles: [`
    :host{display:block}.page-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.overline{font-size:10px;letter-spacing:1.4px;font-weight:700;color:#4180bb;margin:0 0 7px}.page-heading h1{font-size:25px;margin:0;color:#172b44}.subtitle{font-size:13px;color:#7d8da3;margin:7px 0 0}.back-link{font-size:12px;color:#3479b7;text-decoration:none}    .panel{background:#fff;border:1px solid #e9eef4;border-radius:10px;padding:22px;box-shadow:0 3px 14px #1b365008}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px}.form-grid label{display:grid;gap:7px;color:#425870;font-size:12px;font-weight:600}.form-grid input,.form-grid select{height:41px;border:1px solid #dfe6ee;border-radius:6px;padding:0 10px;font:inherit;color:#344b64;background:#fff}.form-grid input:focus,.form-grid select:focus{outline:2px solid #d4e8fb;border-color:#5b9cda}.optional{color:#95a2b1;font-weight:400}.assignment-field,.error{grid-column:1/-1}.error{color:#a4362a;background:#fff0ee;padding:10px;border-radius:6px;font-size:13px;margin:0}.actions{grid-column:1/-1;display:flex;justify-content:flex-end;align-items:center;gap:12px;padding-top:8px}.cancel{color:#64778d;text-decoration:none;font-size:13px}.actions button{background:#2468a8;color:#fff;border:0;border-radius:6px;padding:11px 16px;font-weight:700;cursor:pointer}.actions button:disabled{opacity:.6}
    @media(max-width:600px){.page-heading{align-items:flex-start}.form-grid{grid-template-columns:1fr}}
  `]
})
export class DeviceFormPageComponent implements OnInit {
  readonly staff=signal<StaffOption[]>([]);
  readonly staffError=signal('');
  saving = false;
  error = '';
  assignedTo = '';
  device: {assetTag:string;serialNumber:string;category:string;manufacturer:string;modelName:string;macAddress:string;purchaseCost:number|null;warrantyExpiryDate:string} = {
    assetTag:'', serialNumber:'', category:'LAPTOP', manufacturer:'', modelName:'', macAddress:'', purchaseCost:null, warrantyExpiryDate:''
  };

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.http.get<{items:StaffOption[]}>(`${environment.apiUrl}/api/users`,{params:{active:'true'}}).subscribe({
      next: result => this.staff.set(result.items),
      error: () => this.staffError.set('Staff options could not be loaded. You can still add the device without assigning it.')
    });
  }

  submit(): void {
    this.saving = true;
    this.error = '';
    const {purchaseCost,warrantyExpiryDate,macAddress,...fields} = this.device;
    const payload = {
      ...fields,
      ...(macAddress ? {macAddress} : {}),
      ...(this.assignedTo ? {assignedTo:this.assignedTo} : {}),
      financials: {
        ...(purchaseCost !== null ? {purchaseCost} : {}),
        ...(warrantyExpiryDate ? {warrantyExpiryDate} : {})
      }
    };
    this.http.post(`${environment.apiUrl}/api/devices`, payload).subscribe({
      next: () => void this.router.navigate(['/devices']),
      error: (error: {error?:{error?:string}}) => {
        this.error = error.error?.error ?? 'Could not save this device. Check the details and try again.';
        this.saving = false;
      },
      complete: () => { this.saving = false; }
    });
  }
}
