import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Device {
  _id: string;
  assetTag: string;
  serialNumber: string;
  manufacturer: string;
  modelName: string;
  category: string;
  status: string;
}
interface DeviceDetails extends Device {
  currentAssignee?: {fullName:string;email:string;department:string};
  specs?: {cpu?:string;ramGb?:number;storageGb?:number;osVersion?:string};
  location?: {office?:string;floor?:string;deskOrRack?:string};
  financials?: {purchaseDate?:string;purchaseCost?:number;vendor?:string;warrantyExpiryDate?:string};
  decommissionDetails?: {decommissionedAt?:string;reason?:string;certificateOfDestructionUrl?:string};
}
interface Metrics {
  totalDevices: number;
  byStatus: Record<string, number>;
  warrantyExpiring30: number;
  openMaintenance: number;
  totalAssetValuation: number;
  warrantyAlerts: Array<{_id:string;assetTag:string;manufacturer:string;modelName:string;financials?:{warrantyExpiryDate:string}}>;
}

@Component({
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <header class="page-heading"><div><p class="overline">COMMAND CENTER</p><h1>IT Resource Overview</h1><p class="subtitle">A live view of your managed device fleet.</p></div>
      <a class="primary-button" routerLink="/devices/new"><span aria-hidden="true">＋</span> Add a device</a>
    </header>
    @if (error()) { <p class="notice error">{{error()}}</p> }
    <section class="kpis">
      <article><span>Total fleet</span><strong>{{metrics()?.totalDevices ?? 0}}</strong><small>Managed devices</small></article>
      <article><span>Provisioned</span><strong>{{metrics()?.byStatus?.['PROVISIONED'] ?? 0}}</strong><small>Currently assigned</small></article>
      <article><span>Warranty alerts</span><strong>{{metrics()?.warrantyExpiring30 ?? 0}}</strong><small>Expiring in 30 days</small></article>
      <article><span>Open maintenance</span><strong>{{metrics()?.openMaintenance ?? 0}}</strong><small>Active service tickets</small></article>
    </section>
    <section class="dashboard-grid">
      <article class="panel"><div class="panel-heading"><h2>Fleet status</h2><a routerLink="/devices">View inventory</a></div>
        @for (status of statuses(); track status.name) { <div class="bar-row"><span>{{status.name}}</span><b>{{status.count}}</b><div class="bar"><i [style.width.%]="status.pct"></i></div></div> }
        @if (!statuses().length) { <p class="muted">No fleet data available.</p> }
        <div class="valuation">Total asset valuation <strong>{{metrics()?.totalAssetValuation ?? 0 | currency:'USD':'symbol':'1.0-0'}}</strong></div>
      </article>
      <article class="panel"><div class="panel-heading"><h2>Warranty alerts</h2><span class="badge">{{metrics()?.warrantyAlerts?.length ?? 0}}</span></div>
        @for (device of metrics()?.warrantyAlerts ?? []; track device._id) { <div class="alert-row"><span class="device-dot">!</span><div><b>{{device.assetTag}}</b><small>{{device.manufacturer}} {{device.modelName}}</small></div><time>{{device.financials?.warrantyExpiryDate | date:'MMM d'}}</time></div> }
        @if (!(metrics()?.warrantyAlerts?.length)) { <p class="muted">No upcoming warranty expirations.</p> }
      </article>
    </section>
    <article class="panel inventory"><div class="panel-heading"><div><h2>Recent devices</h2><p class="muted">The latest additions to your inventory</p></div><a routerLink="/devices">See all devices →</a></div>
      <div class="table-wrap"><table><thead><tr><th>ASSET</th><th>DEVICE</th><th>CATEGORY</th><th>STATUS</th></tr></thead><tbody>
        @for (device of devices(); track device._id) { <tr><td><button class="asset-link" type="button" (click)="showDetails(device._id)">{{device.assetTag}}</button><small>{{device.serialNumber}}</small></td><td>{{device.manufacturer}} {{device.modelName}}</td><td>{{device.category.replace('_',' ')}}</td><td><span class="status" [attr.data-status]="device.status">{{device.status}}</span></td></tr> }
        @if (!devices().length) { <tr><td colspan="4" class="muted">No device data available.</td></tr> }
      </tbody></table></div>
    </article>
    @if (selectedDeviceId()) {
      <div class="modal-backdrop" role="presentation" (click)="closeDetails()">
        <section class="device-modal" role="dialog" aria-modal="true" aria-labelledby="device-title" (click)="$event.stopPropagation()" (keydown.escape)="closeDetails()">
          <header class="modal-heading"><div><p class="overline">DEVICE DETAILS</p><h2 id="device-title">{{deviceDetails()?.assetTag ?? 'Loading device…'}}</h2></div><button class="close-button" type="button" aria-label="Close device details" (click)="closeDetails()">×</button></header>
          @if (detailLoading()) { <p class="modal-message">Loading device details…</p> }
          @if (detailError()) { <p class="modal-error">{{detailError()}}</p> }
          @if (deviceDetails(); as device) {
            <div class="detail-summary"><div><strong>{{device.manufacturer}} {{device.modelName}}</strong><span>{{device.serialNumber}}</span></div><span class="status" [attr.data-status]="device.status">{{device.status}}</span></div>
            <div class="detail-grid">
              <article><h3>Asset</h3><dl><dt>Category</dt><dd>{{device.category.replace('_',' ')}}</dd><dt>Assigned to</dt><dd>{{device.currentAssignee?.fullName ?? 'Unassigned'}}</dd><dt>Department</dt><dd>{{device.currentAssignee?.department ?? '—'}}</dd><dt>Email</dt><dd>{{device.currentAssignee?.email ?? '—'}}</dd></dl></article>
              <article><h3>Specifications</h3><dl><dt>Processor</dt><dd>{{device.specs?.cpu ?? '—'}}</dd><dt>Memory</dt><dd>{{device.specs?.ramGb ? device.specs?.ramGb + ' GB' : '—'}}</dd><dt>Storage</dt><dd>{{device.specs?.storageGb ? device.specs?.storageGb + ' GB' : '—'}}</dd><dt>Operating system</dt><dd>{{device.specs?.osVersion ?? '—'}}</dd></dl></article>
              <article><h3>Location</h3><dl><dt>Office</dt><dd>{{device.location?.office ?? '—'}}</dd><dt>Floor</dt><dd>{{device.location?.floor ?? '—'}}</dd><dt>Desk / rack</dt><dd>{{device.location?.deskOrRack ?? '—'}}</dd></dl></article>
              <article><h3>Financials & warranty</h3><dl><dt>Purchase date</dt><dd>{{device.financials?.purchaseDate | date:'mediumDate'}}</dd><dt>Purchase cost</dt><dd>{{device.financials?.purchaseCost ?? 0 | currency:'USD':'symbol':'1.0-0'}}</dd><dt>Vendor</dt><dd>{{device.financials?.vendor ?? '—'}}</dd><dt>Warranty expiry</dt><dd>{{device.financials?.warrantyExpiryDate | date:'mediumDate'}}</dd></dl></article>
            </div>
            @if (device.decommissionDetails?.reason) { <p class="decommission-note"><b>Decommission reason:</b> {{device.decommissionDetails?.reason}}</p> }
          }
          <footer class="modal-footer"><button type="button" class="secondary-button" (click)="closeDetails()">Close</button></footer>
        </section>
      </div>
    }
  `,
  styles: [`
    :host{display:block}.page-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.overline{font-size:10px;letter-spacing:1.4px;font-weight:700;color:#4180bb;margin:0 0 7px}.page-heading h1{font-size:25px;margin:0;color:#172b44}.subtitle{font-size:13px;color:#7d8da3;margin:7px 0 0}
    .primary-button{display:inline-flex;align-items:center;gap:7px;background:#2468a8;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 15px;border-radius:7px}.primary-button:hover{background:#18578f}.primary-button span{font-size:17px;line-height:12px}
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}.kpis article,.panel{background:#fff;border:1px solid #e9eef4;border-radius:10px;box-shadow:0 3px 14px #1b365008}.kpis article{padding:18px}.kpis span,.kpis small{display:block}.kpis span{font-size:12px;color:#72839a}.kpis strong{display:block;font-size:28px;margin:7px 0;color:#172b44}.kpis small{font-size:11px;color:#99a6b6}
    .dashboard-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:15px 0}.panel{padding:19px}.panel-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.panel-heading h2{font-size:15px;margin:0;color:#263c55}.panel-heading a{color:#3479b7;text-decoration:none;font-size:12px}.panel-heading a:hover{text-decoration:underline}
    .bar-row{display:grid;grid-template-columns:130px 32px 1fr;align-items:center;gap:8px;margin:14px 0;font-size:12px;color:#63768d}.bar-row b{color:#344b64}.bar{height:7px;background:#edf2f7;border-radius:7px;overflow:hidden}.bar i{display:block;height:100%;background:#428ed0;border-radius:7px}.valuation{margin-top:21px;padding-top:14px;border-top:1px solid #edf1f5;display:flex;justify-content:space-between;color:#72839a;font-size:12px}.valuation strong{color:#172b44;font-size:14px}
    .badge{background:#eef5fc;color:#3479b7;border-radius:12px;padding:4px 8px;font-size:11px}.alert-row{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f3f6}.alert-row:last-child{border:0}.device-dot{background:#fff1d6;color:#9b6720;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font-size:12px;font-weight:bold}.alert-row b,.alert-row small{display:block}.alert-row b{font-size:12px}.alert-row small,.alert-row time{font-size:11px;color:#8391a3;margin-top:3px}.inventory{padding-bottom:8px}.inventory .panel-heading{margin-bottom:10px}.inventory .panel-heading h2{margin-bottom:5px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:12px}th{font-size:9px;letter-spacing:.8px;color:#8796a8;font-weight:700;padding:10px;border-bottom:1px solid #e9eef4}td{padding:12px 10px;border-bottom:1px solid #f0f3f6;color:#4e6279}td b,td small{display:block}td b{color:#273c55}td small{font-size:10px;color:#96a3b2;margin-top:4px}.status{border-radius:12px;padding:4px 8px;font-size:9px;font-weight:700}.status[data-status="PROVISIONED"]{background:#e2f5e9;color:#28734a}.status[data-status="PROCURED"]{background:#e8f0fd;color:#3866a4}.status[data-status="MAINTENANCE"]{background:#fff2dc;color:#9b6720}.status[data-status="DECOMMISSIONED"]{background:#edf0f3;color:#697786}.muted{color:#91a0b0;font-size:12px}.notice{padding:12px;border-radius:7px;font-size:13px}.error{background:#fff0ee;color:#a4362a}
    .asset-link{padding:0;border:0;background:none;color:#3479b7;font:inherit;font-weight:700;cursor:pointer}.asset-link:hover{text-decoration:underline}
    .modal-backdrop{position:fixed;inset:0;z-index:20;background:#0d1d30a8;display:grid;place-items:center;padding:24px}.device-modal{width:min(760px,100%);max-height:min(90vh,850px);overflow:auto;background:#fff;border-radius:13px;box-shadow:0 20px 70px #08182b66;padding:24px}.modal-heading{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #edf1f5;padding-bottom:15px}.modal-heading h2{font-size:22px;margin:5px 0;color:#172b44}.close-button{border:0;background:#f1f4f8;border-radius:50%;width:32px;height:32px;font-size:22px;line-height:1;color:#586b80;cursor:pointer}.detail-summary{display:flex;align-items:center;justify-content:space-between;padding:18px 0;border-bottom:1px solid #edf1f5}.detail-summary strong,.detail-summary span:not(.status){display:block}.detail-summary strong{font-size:15px;color:#2d435b}.detail-summary span:not(.status){font-size:11px;color:#8796a8;margin-top:5px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 0}.detail-grid article{background:#f7f9fc;padding:14px;border-radius:8px}.detail-grid h3{margin:0 0 11px;font-size:12px;color:#344b64}.detail-grid dl{display:grid;grid-template-columns:1fr 1.2fr;gap:7px;margin:0;font-size:11px}.detail-grid dt{color:#8593a4}.detail-grid dd{margin:0;color:#3e536b;text-align:right}.modal-message,.modal-error{padding:20px 0;font-size:13px;color:#72839a}.modal-error{color:#a4362a}.decommission-note{padding:10px;background:#fff2dc;border-radius:6px;color:#72531e;font-size:12px}.modal-footer{display:flex;justify-content:flex-end;border-top:1px solid #edf1f5;padding-top:15px}.secondary-button{border:1px solid #dfe6ee;background:#fff;border-radius:6px;padding:9px 16px;color:#40546c;cursor:pointer}
    @media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}.dashboard-grid{grid-template-columns:1fr}}@media(max-width:520px){.page-heading{align-items:flex-start;gap:10px}.page-heading h1{font-size:21px}.primary-button{padding:10px;font-size:12px}.kpis{gap:9px}.kpis article{padding:13px}.bar-row{grid-template-columns:105px 24px 1fr}}
    @media(max-width:560px){.modal-backdrop{padding:10px}.device-modal{padding:16px}.detail-grid{grid-template-columns:1fr}}
  `]
})
export class DashboardPageComponent implements OnInit {
  readonly metrics = signal<Metrics | null>(null);
  readonly devices = signal<Device[]>([]);
  readonly statuses = signal<Array<{name:string;count:number;pct:number}>>([]);
  readonly error = signal('');
  readonly selectedDeviceId = signal<string | null>(null);
  readonly deviceDetails = signal<DeviceDetails | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<Metrics>(`${environment.apiUrl}/api/dashboard/metrics`).subscribe({
      next: data => {
        this.metrics.set(data);
        const total = data.totalDevices || 1;
        this.statuses.set(Object.entries(data.byStatus ?? {}).map(([name,count]) => ({name,count,pct:Math.round(count / total * 100)})));
      },
      error: () => this.error.set('Unable to load dashboard metrics. Please refresh or check the API connection.')
    });
    this.http.get<{items:Device[]}>(`${environment.apiUrl}/api/devices`).subscribe({
      next: result => this.devices.set(result.items),
      error: () => this.error.set('Unable to load devices. Please refresh or check the API connection.')
    });
  }

  showDetails(id: string): void {
    this.selectedDeviceId.set(id);
    this.deviceDetails.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.http.get<DeviceDetails>(`${environment.apiUrl}/api/devices/${id}`).subscribe({
      next: device => this.deviceDetails.set(device),
      error: () => this.detailError.set('Unable to load details for this device.'),
      complete: () => this.detailLoading.set(false)
    });
  }

  closeDetails(): void {
    this.selectedDeviceId.set(null);
    this.deviceDetails.set(null);
    this.detailError.set('');
  }
}
