import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface StaffMember {
  _id:string;
  employeeId:string;
  fullName:string;
  email:string;
  role:'IT_ADMIN'|'ASSET_MANAGER'|'EMPLOYEE';
  department:string;
  isActive:boolean;
}

interface StaffForm {
  fullName:string;
  email:string;
  password:string;
  role:StaffMember['role'];
  department:string;
  isActive:boolean;
}

const emptyForm = ():StaffForm=>({
  fullName:'',email:'',password:'',role:'EMPLOYEE',department:'',isActive:true
});

@Component({
  standalone:true,
  imports:[CommonModule,FormsModule],
  template:`
    <header class="page-heading">
      <div><p class="overline">ADMINISTRATION</p><h1>Staff members</h1><p class="subtitle">Manage accounts and staff who can be assigned devices.</p></div>
      <button class="primary-button" type="button" (click)="openCreate()"><span aria-hidden="true">＋</span> Add staff member</button>
    </header>
    @if (message()) { <p class="notice success">{{message()}}</p> }
    @if (error()) { <p class="notice error">{{error()}}</p> }
    <article class="panel">
      <div class="table-toolbar"><div><h2>Staff directory</h2><p>{{staff().length}} people shown</p></div>
        <select aria-label="Filter staff by status" [ngModel]="activeFilter()" (ngModelChange)="activeFilter.set($event);load()"><option value="true">Active staff</option><option value="">All staff</option><option value="false">Inactive staff</option></select>
      </div>
      <div class="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>ROLE</th><th>STATUS</th><th class="actions-heading">ACTIONS</th></tr></thead><tbody>
        @for (person of staff(); track person._id) {
          <tr><td><div class="person"><span class="avatar">{{person.fullName.charAt(0)}}</span><div><b>{{person.fullName}}</b><small>{{person.employeeId}} · {{person.email}}</small></div></div></td><td>{{person.department}}</td><td><span class="role">{{person.role.replace('_',' ')}}</span></td><td><span class="active-status" [class.inactive]="!person.isActive">{{person.isActive?'Active':'Inactive'}}</span></td><td class="actions-cell"><button type="button" class="text-button" (click)="openEdit(person)">Edit</button>@if(person.isActive){<button type="button" class="text-button danger" (click)="deactivate(person)">Deactivate</button>}</td></tr>
        }
        @if (!staff().length && !error()) { <tr><td colspan="5" class="empty">No staff members in this view.</td></tr> }
      </tbody></table></div>
    </article>
    @if (formOpen()) {
      <div class="modal-backdrop" role="presentation" (click)="closeForm()">
        <section class="staff-modal" role="dialog" aria-modal="true" aria-labelledby="form-title" (click)="$event.stopPropagation()">
          <header class="modal-heading"><div><p class="overline">STAFF DIRECTORY</p><h2 id="form-title">{{editingId() ? 'Edit staff member' : 'Add staff member'}}</h2></div><button class="close-button" type="button" aria-label="Close form" (click)="closeForm()">×</button></header>
          <form class="staff-form" (ngSubmit)="save()">
            <label>Full name<input name="fullName" [(ngModel)]="form.fullName" required></label>
            <label>Work email<input name="email" type="email" [(ngModel)]="form.email" required></label>
            <label>Department<select name="department" [(ngModel)]="form.department" required>
              <option value="" disabled>Select a department</option>
              @if(form.department && !departments.includes(form.department)){<option [value]="form.department">{{form.department}}</option>}
              @for(department of departments;track department){<option [value]="department">{{department}}</option>}
            </select></label>
            <label>Role<select name="role" [(ngModel)]="form.role"><option value="EMPLOYEE">Employee</option><option value="ASSET_MANAGER">Asset Manager</option><option value="IT_ADMIN">IT Admin</option></select></label>
            <label>Password<input name="password" type="password" [(ngModel)]="form.password" [required]="!editingId()" minlength="8" [placeholder]="editingId() ? 'Leave blank to keep current password' : 'At least 8 characters'"></label>
            @if(editingId()){<label class="checkbox-label"><input name="isActive" type="checkbox" [(ngModel)]="form.isActive"> Account is active</label>}
            @if(formError()){<p class="notice error">{{formError()}}</p>}
            <footer class="form-actions"><button type="button" class="secondary-button" (click)="closeForm()">Cancel</button><button type="submit" class="primary-button" [disabled]="saving()">{{saving()?'Saving…':editingId()?'Save changes':'Create staff member'}}</button></footer>
          </form>
        </section>
      </div>
    }
  `,
  styles:[`
    :host{display:block}.page-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.overline{font-size:10px;letter-spacing:1.4px;font-weight:700;color:#4180bb;margin:0 0 7px}.page-heading h1{font-size:25px;margin:0;color:#172b44}.subtitle{font-size:13px;color:#7d8da3;margin:7px 0 0}.primary-button{display:inline-flex;align-items:center;gap:7px;background:#2468a8;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 15px;border:0;border-radius:7px;cursor:pointer}.primary-button:hover{background:#18578f}.primary-button span{font-size:17px}
    .panel{background:#fff;border:1px solid #e9eef4;border-radius:10px;padding:18px;box-shadow:0 3px 14px #1b365008}.table-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}.table-toolbar h2{margin:0;color:#263c55;font-size:15px}.table-toolbar p{margin:5px 0 0;color:#8998a9;font-size:11px}.table-toolbar select{height:36px;border:1px solid #dfe6ee;border-radius:6px;padding:0 9px;color:#435970;background:#fff}
    .table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:12px;white-space:nowrap}th{font-size:9px;letter-spacing:.8px;color:#8796a8;padding:11px 10px;border-bottom:1px solid #e9eef4}td{padding:12px 10px;border-bottom:1px solid #f0f3f6;color:#4e6279}.person{display:flex;align-items:center;gap:10px}.avatar{width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;background:#e8f0fd;color:#3866a4;font-weight:700}.person b,.person small{display:block}.person b{color:#273c55}.person small{font-size:10px;color:#96a3b2;margin-top:3px}.role,.active-status{font-size:9px;border-radius:12px;padding:4px 8px;background:#edf3fa;color:#506a86}.active-status{background:#e2f5e9;color:#28734a}.active-status.inactive{background:#edf0f3;color:#697786}.actions-heading{text-align:right}.actions-cell{text-align:right}.text-button{border:0;background:transparent;color:#3479b7;font:inherit;font-size:11px;cursor:pointer;padding:6px}.text-button:hover{text-decoration:underline}.text-button.danger{color:#ad4237}.empty{text-align:center;color:#91a0b0;padding:30px}
    .notice{padding:10px 12px;border-radius:7px;font-size:12px}.success{background:#e5f5ec;color:#28734a}.error{background:#fff0ee;color:#a4362a}
    .modal-backdrop{position:fixed;inset:0;z-index:25;background:#0d1d30a8;display:grid;place-items:center;padding:20px}.staff-modal{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 20px 70px #08182b66;padding:22px}.modal-heading{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #edf1f5;padding-bottom:14px;margin-bottom:18px}.modal-heading h2{font-size:20px;margin:5px 0;color:#172b44}.close-button{border:0;background:#f1f4f8;border-radius:50%;width:30px;height:30px;font-size:22px;line-height:1;color:#586b80;cursor:pointer}.staff-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}.staff-form label{display:grid;gap:6px;color:#425870;font-size:11px;font-weight:600}.staff-form input,.staff-form select{height:39px;border:1px solid #dfe6ee;border-radius:6px;padding:0 10px;color:#344b64;font:inherit;background:#fff}.staff-form input:focus,.staff-form select:focus{outline:2px solid #d4e8fb;border-color:#5b9cda}.staff-form .checkbox-label{display:flex;align-items:center;gap:8px}.staff-form .checkbox-label input{height:auto}.staff-form .notice,.form-actions{grid-column:1/-1}.form-actions{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding-top:6px}.secondary-button{border:1px solid #dfe6ee;background:#fff;border-radius:6px;padding:10px 14px;color:#40546c;cursor:pointer}.form-actions .primary-button{font-size:11px;padding:10px 13px}.form-actions .primary-button:disabled{opacity:.6}
    @media(max-width:650px){.page-heading{align-items:flex-start;gap:10px}.page-heading h1{font-size:21px}.primary-button{padding:10px;font-size:11px}.staff-form{grid-template-columns:1fr}.staff-form .notice,.form-actions{grid-column:1}}
  `]
})
export class StaffPageComponent implements OnInit {
  readonly departments=['Asset Management','Engineering','Finance','IT Operations','Marketing','Operations','Security'];
  readonly staff=signal<StaffMember[]>([]);
  readonly formOpen=signal(false);
  readonly editingId=signal<string|null>(null);
  readonly saving=signal(false);
  readonly error=signal('');
  readonly formError=signal('');
  readonly message=signal('');
  readonly activeFilter=signal('true');
  form=emptyForm();

  constructor(private http:HttpClient){}

  ngOnInit():void { this.load(); }

  load():void {
    this.error.set('');
    const active=this.activeFilter();
    const params:Record<string,string>={};
    if(active)params['active']=active;
    this.http.get<{items:StaffMember[]}>(`${environment.apiUrl}/api/users`,{params}).subscribe({
      next:result=>this.staff.set(result.items),
      error:(error:{status:number})=>this.error.set(error.status===403?'Only IT administrators can manage staff accounts.':'Unable to load staff directory.')
    });
  }

  openCreate():void {
    this.editingId.set(null);
    this.form=emptyForm();
    this.formError.set('');
    this.formOpen.set(true);
  }

  openEdit(person:StaffMember):void {
    this.editingId.set(person._id);
    this.form={fullName:person.fullName,email:person.email,password:'',role:person.role,department:person.department,isActive:person.isActive};
    this.formError.set('');
    this.formOpen.set(true);
  }

  closeForm():void { this.formOpen.set(false); }

  save():void {
    this.saving.set(true);
    this.formError.set('');
    const {password,...fields}=this.form;
    const payload=this.editingId()?(password?{...fields,password}:fields):this.form;
    const request=this.editingId()
      ?this.http.patch<StaffMember>(`${environment.apiUrl}/api/users/${this.editingId()}`,payload)
      :this.http.post<StaffMember>(`${environment.apiUrl}/api/users`,payload);
    request.subscribe({
      next:(saved:StaffMember)=>{
        this.message.set(this.editingId()?'Staff member updated.':`${saved.fullName} added with Employee ID ${saved.employeeId}.`);
        this.closeForm();
        this.load();
      },
      error:(error:{error?:{error?:string}})=>{
        this.formError.set(error.error?.error??'Unable to save staff member. Check the form and try again.');
        this.saving.set(false);
      },
      complete:()=>this.saving.set(false)
    });
  }

  deactivate(person:StaffMember):void {
    if(!window.confirm(`Deactivate ${person.fullName}? Their assignment history will be preserved.`))return;
    this.message.set('');
    this.http.delete(`${environment.apiUrl}/api/users/${person._id}`).subscribe({
      next:()=>{
        this.message.set(`${person.fullName} was deactivated.`);
        this.load();
      },
      error:(error:{error?:{error?:string}})=>this.error.set(error.error?.error??'Unable to deactivate staff member.')
    });
  }
}
