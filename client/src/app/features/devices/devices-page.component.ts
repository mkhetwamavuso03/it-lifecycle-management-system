import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface DeviceRow {
  _id: string;
  assetTag: string;
  serialNumber: string;
  manufacturer: string;
  modelName: string;
  category: string;
  status: string;
  currentAssignee?: {fullName:string;department:string};
  financials?: {warrantyExpiryDate?:string};
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <header class="page-heading"><div><p class="overline">ASSET MANAGEMENT</p><h1>Device inventory</h1><p class="subtitle">Search and review your organization's managed hardware.</p></div><a class="primary-button" routerLink="/devices/new"><span aria-hidden="true">＋</span> Add a device</a></header>
    <article class="panel">
      <form class="filters" (ngSubmit)="load()"><input name="search" [(ngModel)]="search" placeholder="Search asset tag, serial, or model"><select name="status" [(ngModel)]="status"><option value="">All statuses</option><option>PROCURED</option><option>PROVISIONED</option><option>MAINTENANCE</option><option>DECOMMISSIONED</option></select><select name="category" [(ngModel)]="category"><option value="">All categories</option><option>LAPTOP</option><option>WORKSTATION</option><option>MOBILE</option><option>SERVER</option><option>NETWORK_GEAR</option><option>PERIPHERAL</option></select><button class="filter-button">Filter</button></form>
      @if (error()) { <p class="error">{{error()}}</p> }
      <div class="table-wrap"><table><thead><tr><th>ASSET</th><th>DEVICE</th><th>CATEGORY</th><th>ASSIGNEE</th><th>STATUS</th><th>WARRANTY</th></tr></thead><tbody>
      @for (device of devices(); track device._id) { <tr><td><b>{{device.assetTag}}</b><small>{{device.serialNumber}}</small></td><td>{{device.manufacturer}} {{device.modelName}}</td><td>{{device.category.replace('_',' ')}}</td><td>{{device.currentAssignee?.fullName ?? '—'}}<small>{{device.currentAssignee?.department ?? ''}}</small></td><td><span class="status" [attr.data-status]="device.status">{{device.status}}</span></td><td>{{device.financials?.warrantyExpiryDate | date:'MMM d, y'}}</td></tr> }
      @if (!devices().length && !error()) { <tr><td class="empty" colspan="6">No matching devices.</td></tr> }
      </tbody></table></div>
      <footer>{{devices().length}} devices shown</footer>
    </article>
  `,
  styles: [`
    :host{display:block}.page-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.overline{font-size:10px;letter-spacing:1.4px;font-weight:700;color:#4180bb;margin:0 0 7px}.page-heading h1{font-size:25px;margin:0;color:#172b44}.subtitle{font-size:13px;color:#7d8da3;margin:7px 0 0}.primary-button{display:inline-flex;align-items:center;gap:7px;background:#2468a8;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 15px;border-radius:7px}.primary-button span{font-size:17px}
    .panel{background:#fff;border:1px solid #e9eef4;border-radius:10px;padding:18px;box-shadow:0 3px 14px #1b365008}.filters{display:flex;gap:9px;margin-bottom:16px}.filters input{flex:1;min-width:120px}.filters input,.filters select{height:39px;border:1px solid #dfe6ee;border-radius:6px;padding:0 10px;color:#435970;background:#fff}.filter-button{border:0;border-radius:6px;background:#edf5fc;color:#2e6fa8;padding:0 16px;cursor:pointer}
    .table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:12px;white-space:nowrap}th{font-size:9px;letter-spacing:.8px;color:#8796a8;padding:11px 10px;border-bottom:1px solid #e9eef4}td{padding:12px 10px;border-bottom:1px solid #f0f3f6;color:#4e6279}td b,td small{display:block}td b{color:#273c55}td small{font-size:10px;color:#96a3b2;margin-top:4px}.status{border-radius:12px;padding:4px 8px;font-size:9px;font-weight:700}.status[data-status="PROVISIONED"]{background:#e2f5e9;color:#28734a}.status[data-status="PROCURED"]{background:#e8f0fd;color:#3866a4}.status[data-status="MAINTENANCE"]{background:#fff2dc;color:#9b6720}.status[data-status="DECOMMISSIONED"]{background:#edf0f3;color:#697786}footer{font-size:11px;color:#8998a9;padding:14px 10px 0}.empty{color:#91a0b0;text-align:center;padding:30px}.error{color:#a4362a;font-size:13px}
    @media(max-width:700px){.page-heading{align-items:flex-start;gap:10px}.page-heading h1{font-size:21px}.primary-button{padding:10px;font-size:12px}.filters{flex-wrap:wrap}.filters input{flex-basis:100%}.filters select{flex:1}}
  `]
})
export class DevicesPageComponent implements OnInit {
  readonly devices = signal<DeviceRow[]>([]);
  readonly error = signal('');
  search = '';
  status = '';
  category = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    const params: Record<string,string> = {};
    if (this.search.trim()) params['q'] = this.search.trim();
    if (this.status) params['status'] = this.status;
    if (this.category) params['category'] = this.category;
    this.error.set('');
    this.http.get<{items:DeviceRow[]}>(`${environment.apiUrl}/api/devices`, {params}).subscribe({
      next: result => this.devices.set(result.items),
      error: () => this.error.set('Could not load devices. Please try again.')
    });
  }
}
