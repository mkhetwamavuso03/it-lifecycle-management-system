import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AuditRow {
  _id:string;entityType:string;entityId:string;action:string;performedBy:string;timestamp:string;
  previousState?:unknown;newState?:unknown;ipAddress?:string;
}

@Component({
  standalone:true,
  imports:[CommonModule,DatePipe],
  template:`
    <header class="page-heading"><div><p class="overline">COMPLIANCE & HISTORY</p><h1>Audit logs</h1><p class="subtitle">An append-only record of important events across your environment.</p></div><span class="immutable">● Immutable log</span></header>
    @if(error()){<p class="error">{{error()}}</p>}
    <article class="panel"><div class="table-wrap"><table><thead><tr><th>TIME</th><th>ENTITY</th><th>ACTION</th><th>ENTITY ID</th><th>PERFORMED BY</th><th>IP ADDRESS</th></tr></thead><tbody>
      @for(log of logs();track log._id){<tr><td>{{log.timestamp | date:'MMM d, y, h:mm a'}}</td><td><span class="entity">{{log.entityType}}</span></td><td><b>{{log.action.replace('_',' ')}}</b></td><td class="id">{{log.entityId}}</td><td class="id">{{log.performedBy}}</td><td>{{log.ipAddress ?? '—'}}</td></tr>}
      @if(!logs().length&&!error()){<tr><td colspan="6" class="empty">No audit entries to show.</td></tr>}
    </tbody></table></div><footer>Showing {{logs().length}} recent entries</footer></article>
  `,
  styles:[`
    :host{display:block}.page-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.overline{font-size:10px;letter-spacing:1.4px;font-weight:700;color:#4180bb;margin:0 0 7px}.page-heading h1{font-size:25px;margin:0;color:#172b44}.subtitle{font-size:13px;color:#7d8da3;margin:7px 0 0}.immutable{font-size:11px;color:#37815a;background:#e5f5ec;padding:7px 10px;border-radius:15px}.panel{background:#fff;border:1px solid #e9eef4;border-radius:10px;padding:18px;box-shadow:0 3px 14px #1b365008}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:11px;white-space:nowrap}th{font-size:9px;letter-spacing:.8px;color:#8796a8;padding:11px 9px;border-bottom:1px solid #e9eef4}td{padding:12px 9px;border-bottom:1px solid #f0f3f6;color:#4e6279}td b{color:#273c55}.entity{font-size:9px;font-weight:700;background:#edf3fa;color:#506a86;border-radius:12px;padding:4px 8px}.id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#7e8ea1;max-width:145px;overflow:hidden;text-overflow:ellipsis}.empty{text-align:center;color:#91a0b0;padding:28px}footer{font-size:11px;color:#8998a9;padding:14px 10px 0}.error{color:#a4362a;font-size:13px}
  `]
})
export class AuditLogsPageComponent implements OnInit{
  readonly logs=signal<AuditRow[]>([]);
  readonly error=signal('');
  constructor(private http:HttpClient){}
  ngOnInit():void{
    this.http.get<{items:AuditRow[]}>(`${environment.apiUrl}/api/audit-logs`).subscribe({
      next:result=>this.logs.set(result.items),
      error:(error:{status:number})=>this.error.set(error.status===403?'Your account does not have permission to view audit logs.':'Could not load audit logs. Please try again.')
    });
  }
}
