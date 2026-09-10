(() => {
  "use strict";
  const config = window.TOURNAMENT_CONFIG;
  const SUPABASE_URL = "https://miavgvlffiloxsardwxl.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BhGGAi7yqRaKoMNaSkMm0A_G7lcgvUN";
  const SUPABASE_SESSION_KEY = `animo-supabase-session-${config.tournamentId}`;
  const RECORDS_KEY = `animo-registration-records-${config.tournamentId}`;
  const ADMIN_CONFIG_KEY = `animo-admin-config-${config.tournamentId}-v12`;
  const REPORT_DASHBOARD_KEY = `animo-report-dashboard-${config.tournamentId}`;
  const ACCESS_CONTROL_KEY = `animo-access-control-${config.tournamentId}`;
  const ACCESS_AUDIT_KEY = `animo-access-audit-${config.tournamentId}`;
  const ACCESS_PREVIEW_ROLE_KEY = `animo-access-preview-role-${config.tournamentId}`;
  const EMAIL_NOTIFICATION_KEY = `animo-email-notifications-${config.tournamentId}`;
  const EMAIL_ACTIVITY_KEY = `animo-email-activity-${config.tournamentId}`;
  const ADMIN_ACTIVITY_KEY = `animo-admin-activity-${config.tournamentId}`;

  const PERMISSIONS = [
    {id:"registrations.view",group:"Registration",label:"View registrations",help:"Search and view registration records."},
    {id:"registrations.edit",group:"Registration",label:"Edit non-decision details",help:"Update operational player information that does not determine eligibility."},
    {id:"registrations.status",group:"Registration",label:"Update operational status",help:"Move records through non-decision workflow statuses such as Pending."},
    {id:"registrations.approve",group:"Registration",label:"Approve registrations",help:"Accept registrations after required validation is complete."},
    {id:"registrations.confirm",group:"Registration",label:"Confirm participants",help:"Mark an approved participant as officially confirmed."},
    {id:"registrations.reject",group:"Registration",label:"Reject or cancel registrations",help:"Decline or cancel a registration."},

    {id:"eligibility.verify",group:"Eligibility",label:"Verify eligibility evidence",help:"Verify DUPR screenshots and request replacement proof."},
    {id:"eligibility.reclassify",group:"Eligibility",label:"Reclassify player level",help:"Correct DUPR ratings, validate no-DUPR levels, and resolve categories."},

    {id:"payments.view",group:"Payments",label:"View payment status",help:"See payment status and proof metadata."},
    {id:"payments.verify",group:"Payments",label:"Verify payments",help:"Mark payments as checked or flag payment issues."},

    {id:"checkin.manage",group:"Tournament Operations",label:"Manage attendance / check-in",help:"Check players in on tournament day."},
    {id:"jersey.manage",group:"Tournament Operations",label:"Manage jersey release",help:"Track jersey distribution and operational handoff."},

    {id:"reports.view",group:"Reports",label:"View operational reports",help:"Access registration and tournament-readiness reports."},
    {id:"reports.financial",group:"Reports",label:"View financial reports",help:"Access fee, payment, and financial report views."},

    {id:"data.export",group:"Data",label:"Download registration data",help:"Download registration and report tables."},
    {id:"data.delete",group:"Data",label:"Delete / trash records",help:"Move registration records to trash or perform destructive record actions."},

    {id:"settings.event",group:"Tournament Setup",label:"Edit event details",help:"Change tournament name, dates, venue, and event information."},
    {id:"settings.divisions",group:"Tournament Setup",label:"Edit divisions & fees",help:"Change divisions, capacity, and fees."},
    {id:"settings.levels",group:"Tournament Setup",label:"Edit level rules",help:"Change DUPR thresholds and level rules."},
    {id:"settings.content",group:"Tournament Setup",label:"Edit public-site content",help:"Manage homepage, FAQ, and organizer contact content."},
    {id:"backup.manage",group:"System",label:"Backup & restore",help:"Download or restore a full portal backup."},
    {id:"notifications.manage",group:"System",label:"Manage email notifications",help:"Configure player email triggers and message templates."},

    {id:"access.manage",group:"System",label:"Manage access & roles",help:"Add team members, change role assignments, and configure role permissions.",directorOnly:true}
  ];

  const TAB_PERMISSIONS = {
    registrations:"registrations.view",
    reports:"reports.view",
    details:"settings.event",
    divisions:"settings.divisions",
    dupr:"settings.levels",
    hero:"settings.content",
    faq:"settings.content",
    contact:"settings.content",
    notifications:"notifications.manage",
    activity:"access.manage",
    backup:"backup.manage",
    access:"access.manage"
  };
  let adminDraft = null;
  let adminTab = "registrations";
  let statusFilter = "all";
  let divisionFilter = "all";
  let searchTerm = "";
  let reportKey = "status";
  let reportChartType = "auto";
  let reportStatus = "all";
  let reportDivision = "all";
  let reportLevel = "all";
  let reportCategory = "all";
  let reportDateWindow = "all";
  let dashboardEditMode = false;
  let dashboardConfigTarget = null;
  let draggedDashboardWidgetId = null;
  let accessSelectedRoleId = "admin";
  let accessDialogMode = null;
  let accessEditingMemberId = null;
  let selectedEmailTemplateId = "registration_received";
  let supabaseSession = null;
  let supabaseAccessProfile = null;
  let authInitializing = false;
  let activityCategoryFilter = "all";
  let activityActorFilter = "all";
  let activityDateFilter = "30";
  let activitySearch = "";

  // =========================================================
  // GLOBAL ADMIN ACTIVITY LOG
  // =========================================================
  function getAdminActivity(){
    try{
      const rows=JSON.parse(localStorage.getItem(ADMIN_ACTIVITY_KEY)||"[]");
      return Array.isArray(rows)?rows:[];
    }catch{return []}
  }

  function saveAdminActivity(rows){
    try{
      localStorage.setItem(ADMIN_ACTIVITY_KEY,JSON.stringify((Array.isArray(rows)?rows:[]).slice(0,500)));
    }catch(e){console.warn(e)}
  }

  function activityActor(){
    return {
      name:supabaseAccessProfile?.display_name||supabaseSession?.user?.email||"Organizer",
      email:supabaseAccessProfile?.email||supabaseSession?.user?.email||"",
      role:supabaseAccessProfile?.role?.name||"Organizer"
    };
  }

  function activityDetailText(details){
    if(details==null)return "";
    if(typeof details==="string")return details;
    if(Array.isArray(details))return details.join(" · ");
    if(typeof details==="object"){
      return Object.entries(details)
        .filter(([,value])=>value!==undefined&&value!==null&&String(value)!=="")
        .map(([key,value])=>`${String(key).replace(/([A-Z])/g," $1").replace(/_/g," ").replace(/^./,m=>m.toUpperCase())}: ${value}`)
        .join(" · ");
    }
    return String(details);
  }

  function recordAdminActivity(category,action,details={},options={}){
    const actor=activityActor();
    const rows=getAdminActivity();
    rows.unshift({
      id:`activity-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      at:new Date().toISOString(),
      category:String(category||"System"),
      action:String(action||"Activity"),
      actorName:options.actorName||actor.name,
      actorEmail:options.actorEmail===undefined?actor.email:options.actorEmail,
      role:options.role||actor.role,
      target:String(options.target||""),
      reference:String(options.reference||""),
      details:activityDetailText(details),
      source:String(options.source||"Admin Portal"),
      result:String(options.result||"Completed")
    });
    saveAdminActivity(rows);
  }

  function mappedAccessActivity(){
    return getAccessAudit().map(row=>({
      id:`access-${row.id}`,
      at:row.at,
      category:"Access Control",
      action:row.action,
      actorName:row.actor||"Director",
      actorEmail:"",
      role:row.actor||"Director",
      target:row.details?.roleId||row.details?.memberId||"",
      reference:"",
      details:activityDetailText(row.details||{}),
      source:"Access & Roles",
      result:"Completed"
    }));
  }

  function mappedEmailActivity(){
    return getEmailActivity().map(row=>({
      id:`email-${row.id}`,
      at:row.at,
      category:"Email",
      action:`${row.templateLabel||"Email Notification"} · ${row.result||"Triggered"}`,
      actorName:"Automatic Workflow",
      actorEmail:"",
      role:"System",
      target:[row.reference,row.recipientName].filter(Boolean).join(" · "),
      reference:row.reference||"",
      details:[row.source,row.recipientEmail,row.detail].filter(Boolean).join(" · "),
      source:"Email Notifications",
      result:row.result||"Triggered"
    }));
  }

  function allActivityRows(){
    const seen=new Set();
    return [...getAdminActivity(),...mappedAccessActivity(),...mappedEmailActivity()]
      .filter(row=>{
        const key=row.id||`${row.at}-${row.category}-${row.action}-${row.target}`;
        if(seen.has(key))return false;
        seen.add(key);
        return true;
      })
      .sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
  }

  function activityCategoryTone(category){
    const key=String(category||"").toLowerCase();
    if(key.includes("registration"))return "registration";
    if(key.includes("eligibility"))return "eligibility";
    if(key.includes("access"))return "access";
    if(key.includes("email"))return "email";
    if(key.includes("auth"))return "auth";
    if(key.includes("config"))return "config";
    if(key.includes("data"))return "data";
    return "system";
  }

  function activityDateCutoff(){
    if(activityDateFilter==="all")return null;
    const days=Number(activityDateFilter);
    if(!Number.isFinite(days))return null;
    return Date.now()-(days*24*60*60*1000);
  }

  function filteredActivityRows(){
    const cutoff=activityDateCutoff();
    const needle=activitySearch.trim().toLowerCase();
    return allActivityRows().filter(row=>{
      if(cutoff&&new Date(row.at).getTime()<cutoff)return false;
      if(activityCategoryFilter!=="all"&&row.category!==activityCategoryFilter)return false;
      if(activityActorFilter!=="all"&&row.actorName!==activityActorFilter)return false;
      if(needle){
        const hay=[
          row.action,row.actorName,row.actorEmail,row.role,row.category,
          row.target,row.reference,row.details,row.source,row.result
        ].join(" ").toLowerCase();
        if(!hay.includes(needle))return false;
      }
      return true;
    });
  }

  function activityTimestamp(value){
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return {date:"—",time:""};
    return {
      date:date.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}),
      time:date.toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"})
    };
  }

  function exportActivityLog(){
    if(!can("access.manage")){showToast("Your role cannot export the activity log");return}
    const rows=filteredActivityRows();
    const table=[["Date/Time","Actor","Email","Role","Category","Activity","Target","Details","Source","Result"]];
    rows.forEach(row=>{
      table.push([
        new Date(row.at).toLocaleString("en-PH"),
        row.actorName||"",
        row.actorEmail||"",
        row.role||"",
        row.category||"",
        row.action||"",
        row.target||row.reference||"",
        row.details||"",
        row.source||"",
        row.result||""
      ]);
    });
    download(table.map(row=>row.map(csvCell).join(",")).join("\n"),"animo-admin-activity-log.csv","text/csv;charset=utf-8");
    recordAdminActivity("Data","Exported activity log",{rows:rows.length},{target:"Activity Log"});
    showToast("Activity log downloaded");
  }

  function clearLocalAdminActivity(){
    if(!can("access.manage"))return;
    if(!confirm("Clear the locally recorded Admin activity? Access-role history and email trigger history will remain available."))return;
    saveAdminActivity([]);
    renderAdmin();
    showToast("Local Admin activity cleared");
  }

  function allPermissionIds(){return PERMISSIONS.map(p=>p.id)}
  function defaultAccessControl(){
    const all=allPermissionIds();
    return {
      roles:[
        {id:"director",name:"Director",description:"Full tournament control and visibility.",protected:true,permissions:[...all]},
        {id:"admin",name:"Admin",description:"Registration operations and non-decision tournament tasks.",protected:true,permissions:["registrations.view","registrations.edit","registrations.status","payments.view","checkin.manage","jersey.manage","data.export"]},
        {id:"eligibility",name:"Eligibility Officer",description:"Level verification, DUPR review, and player classification decisions.",protected:true,permissions:["registrations.view","registrations.approve","registrations.reject","eligibility.verify","eligibility.reclassify","reports.view","data.export"]},
        {id:"finance",name:"Finance Officer",description:"Payment review, payment verification, and financial reporting.",protected:true,permissions:["registrations.view","payments.view","payments.verify","reports.view","reports.financial","data.export"]},
        {id:"checkin",name:"Check-in Staff",description:"Tournament-day attendance and jersey operations only.",protected:true,permissions:["registrations.view","checkin.manage","jersey.manage"]},
        {id:"viewer",name:"Viewer",description:"Read-only registration and operational reporting access.",protected:true,permissions:["registrations.view","reports.view"]}
      ],
      members:[
        {id:"member-director",name:"Tournament Director",email:"director@animo.local",roleId:"director",status:"Active",createdAt:new Date().toISOString()}
      ]
    };
  }

  function normalizeAccessControl(value){
    const fallback=defaultAccessControl();
    const roleIds=new Set();
    const roles=(Array.isArray(value?.roles)?value.roles:fallback.roles).map((role,index)=>{
      const id=String(role?.id||`custom-${Date.now()}-${index}`).replace(/[^a-zA-Z0-9_-]/g,"-");
      roleIds.add(id);
      const isDirector=id==="director";
      return {
        id,
        name:String(role?.name||"Custom Role").trim()||"Custom Role",
        description:String(role?.description||"").trim(),
        protected:isDirector||!!role?.protected,
        permissions:isDirector?[...allPermissionIds()]:[...new Set((Array.isArray(role?.permissions)?role.permissions:[]).filter(p=>allPermissionIds().includes(p)&&p!=="access.manage"))]
      };
    });
    if(!roles.some(r=>r.id==="director"))roles.unshift(fallback.roles[0]);

    const validRoles=new Set(roles.map(r=>r.id));
    let members=(Array.isArray(value?.members)?value.members:fallback.members).map((member,index)=>({
      id:String(member?.id||`member-${Date.now()}-${index}`),
      name:String(member?.name||"Team Member").trim()||"Team Member",
      email:String(member?.email||"").trim().toLowerCase(),
      roleId:validRoles.has(member?.roleId)?member.roleId:"viewer",
      status:member?.status==="Disabled"?"Disabled":"Active",
      createdAt:member?.createdAt||new Date().toISOString()
    }));
    if(!members.some(m=>m.roleId==="director"&&m.status==="Active")){
      members.unshift(fallback.members[0]);
    }
    return {roles,members};
  }

  function getAccessControl(){
    try{
      const raw=localStorage.getItem(ACCESS_CONTROL_KEY);
      if(raw)return normalizeAccessControl(JSON.parse(raw));
    }catch(e){console.warn(e)}
    const fresh=defaultAccessControl();
    try{localStorage.setItem(ACCESS_CONTROL_KEY,JSON.stringify(fresh))}catch(e){}
    return fresh;
  }

  function saveAccessControl(access,message="",details={}){
    const normalized=normalizeAccessControl(access);
    localStorage.setItem(ACCESS_CONTROL_KEY,JSON.stringify(normalized));
    if(message)logAccessChange(message,details);
    return normalized;
  }

  function getAccessAudit(){
    try{return JSON.parse(localStorage.getItem(ACCESS_AUDIT_KEY)||"[]")}catch{return []}
  }

  function logAccessChange(action,details={}){
    const rows=getAccessAudit();
    rows.unshift({id:`audit-${Date.now()}`,at:new Date().toISOString(),action,details,actor:currentRole()?.name||"Director"});
    try{localStorage.setItem(ACCESS_AUDIT_KEY,JSON.stringify(rows.slice(0,60)))}catch(e){}
  }

  function roleById(id){
    return getAccessControl().roles.find(r=>r.id===id)||null;
  }

  function currentRole(){
    if(!supabaseAccessProfile?.role)return null;
    return {
      id:supabaseAccessProfile.role.key,
      key:supabaseAccessProfile.role.key,
      name:supabaseAccessProfile.role.name,
      isDirector:!!supabaseAccessProfile.role.is_director,
      permissions:Array.isArray(supabaseAccessProfile.permissions)?supabaseAccessProfile.permissions:[]
    };
  }

  function can(permission){
    const role=currentRole();
    if(!role||supabaseAccessProfile?.status!=="Active")return false;
    if(role.isDirector)return true;
    return role.permissions.includes(permission);
  }

  function canAny(...permissions){return permissions.some(can)}

  function firstAccessibleTab(){
    return Object.keys(TAB_PERMISSIONS).find(tab=>can(TAB_PERMISSIONS[tab]))||"registrations";
  }

  function statusPermission(status){
    if(status==="Approved")return "registrations.approve";
    if(status==="Confirmed")return "registrations.confirm";
    if(["Rejected","Cancelled"].includes(status))return "registrations.reject";
    return "registrations.status";
  }

  function permittedStatusOptions(record){
    const statuses=["Submitted","Payment Submitted","Awaiting Partner","Pending Level Validation","Pending","Approved","Confirmed","Rejected","Cancelled"];
    const allowed=statuses.filter(s=>can(statusPermission(s)));
    if(record?.status&&!allowed.includes(record.status))allowed.unshift(record.status);
    return [...new Set(allowed)];
  }

  function currentTabCanSave(){
    return (adminTab==="details"&&can("settings.event"))||
      (adminTab==="divisions"&&can("settings.divisions"))||
      (adminTab==="dupr"&&can("settings.levels"))||
      (["hero","faq","contact"].includes(adminTab)&&can("settings.content"));
  }

  function refreshAccessChrome(){
    const role=currentRole();

    $$(".admin-tab").forEach(btn=>{
      const needed=TAB_PERMISSIONS[btn.dataset.adminTab];
      btn.hidden=needed?!can(needed):false;
    });

    const name=$("#adminSessionName");
    if(name)name.textContent=supabaseAccessProfile?.display_name||"Organizer";

    const email=$("#adminSessionEmail");
    if(email)email.textContent=supabaseAccessProfile?.email||supabaseSession?.user?.email||"Signed in";

    const badge=$("#adminSessionRole");
    if(badge)badge.textContent=role?.name||"No role";

    const identity=$("#adminBackendIdentity");
    if(identity){
      const count=Array.isArray(supabaseAccessProfile?.permissions)?supabaseAccessProfile.permissions.length:0;
      identity.textContent=role?`${role.name} · ${count} permission${count===1?"":"s"} · ${supabaseAccessProfile.status}`:"Organizer access unavailable";
    }

    const save=$("#savePublishButton");
    if(save)save.hidden=!currentTabCanSave();
    const download=$("#exportCsvButton");
    if(download)download.hidden=!can("data.export");
  }

  // =========================================================
  // SUPABASE AUTH — REAL ORGANIZER LOGIN
  // =========================================================
  function readStoredSupabaseSession(){
    try{
      const value=JSON.parse(localStorage.getItem(SUPABASE_SESSION_KEY)||"null");
      return value&&value.access_token&&value.refresh_token?value:null;
    }catch{return null}
  }

  function writeSupabaseSession(session){
    supabaseSession=session||null;
    if(session){
      try{localStorage.setItem(SUPABASE_SESSION_KEY,JSON.stringify(session))}catch(e){}
    }else{
      localStorage.removeItem(SUPABASE_SESSION_KEY);
    }
  }

  function authStatus(message,type="info"){
    const box=$("#adminAuthStatus");
    if(!box)return;
    if(!message){
      box.hidden=true;
      box.textContent="";
      box.className="admin-auth-status";
      return;
    }
    box.hidden=false;
    box.textContent=message;
    box.className=`admin-auth-status ${type}`;
  }

  function setAuthLoading(loading,label="Signing in…"){
    const button=$("#adminLoginButton");
    if(button){
      button.disabled=!!loading;
      button.textContent=loading?label:"Sign In";
    }
  }

  async function supabaseRequest(path,{method="GET",body=null,accessToken=null}={}){
    const headers={
      "apikey":SUPABASE_PUBLISHABLE_KEY,
      "Accept":"application/json"
    };
    if(body!==null)headers["Content-Type"]="application/json";
    if(accessToken)headers["Authorization"]=`Bearer ${accessToken}`;

    let response;
    try{
      response=await fetch(`${SUPABASE_URL}${path}`,{
        method,
        headers,
        body:body===null?undefined:JSON.stringify(body)
      });
    }catch(error){
      const networkError=new Error("Could not reach Supabase. Check your internet connection and try again.");
      networkError.cause=error;
      throw networkError;
    }

    let payload=null;
    const contentType=response.headers.get("content-type")||"";
    if(contentType.includes("application/json")){
      try{payload=await response.json()}catch{}
    }else{
      try{payload=await response.text()}catch{}
    }

    if(!response.ok){
      const message=
        payload?.msg||
        payload?.message||
        payload?.error_description||
        payload?.error||
        (typeof payload==="string"?payload:"")||
        `Supabase request failed (${response.status})`;
      const error=new Error(message);
      error.status=response.status;
      error.payload=payload;
      throw error;
    }

    return payload;
  }

  function normalizeSupabaseSession(payload){
    if(!payload?.access_token||!payload?.refresh_token)return null;
    const now=Math.floor(Date.now()/1000);
    return {
      access_token:payload.access_token,
      refresh_token:payload.refresh_token,
      token_type:payload.token_type||"bearer",
      expires_in:Number(payload.expires_in||3600),
      expires_at:Number(payload.expires_at||now+Number(payload.expires_in||3600)),
      user:payload.user||supabaseSession?.user||null
    };
  }

  function sessionNeedsRefresh(session){
    if(!session?.access_token)return true;
    const now=Math.floor(Date.now()/1000);
    return !session.expires_at||Number(session.expires_at)<=now+90;
  }

  async function refreshSupabaseSession(){
    if(!supabaseSession?.refresh_token)throw new Error("Your session has expired. Please sign in again.");
    const payload=await supabaseRequest("/auth/v1/token?grant_type=refresh_token",{
      method:"POST",
      body:{refresh_token:supabaseSession.refresh_token}
    });
    const refreshed=normalizeSupabaseSession(payload);
    if(!refreshed)throw new Error("Supabase did not return a valid refreshed session.");
    writeSupabaseSession(refreshed);
    return refreshed;
  }

  async function ensureFreshSupabaseSession(){
    if(!supabaseSession)throw new Error("Authentication required.");
    if(sessionNeedsRefresh(supabaseSession)){
      await refreshSupabaseSession();
    }
    return supabaseSession;
  }

  async function loadMyAdminAccess({retry=true}={}){
    await ensureFreshSupabaseSession();
    try{
      const profile=await supabaseRequest("/rest/v1/rpc/get_my_admin_access",{
        method:"POST",
        body:{},
        accessToken:supabaseSession.access_token
      });
      if(!profile?.role)throw new Error("Supabase returned an incomplete organizer access profile.");
      supabaseAccessProfile=profile;
      return profile;
    }catch(error){
      if(retry&&(error.status===401||error.status===403)){
        await refreshSupabaseSession();
        return loadMyAdminAccess({retry:false});
      }
      throw error;
    }
  }

  function unlockAdmin(){
    document.body.classList.remove("auth-locked");
    document.body.classList.add("auth-ready");
    const gate=$("#adminAuthGate");
    if(gate)gate.hidden=true;
    refreshAccessChrome();
  }

  function lockAdmin(message=""){
    supabaseAccessProfile=null;
    document.body.classList.add("auth-locked");
    document.body.classList.remove("auth-ready");
    const gate=$("#adminAuthGate");
    if(gate)gate.hidden=false;
    authStatus(message,message?"error":"info");
  }

  async function signInAdmin(email,password){
    const payload=await supabaseRequest("/auth/v1/token?grant_type=password",{
      method:"POST",
      body:{email,password}
    });
    const session=normalizeSupabaseSession(payload);
    if(!session)throw new Error("Supabase did not return a valid login session.");
    writeSupabaseSession(session);

    try{
      await loadMyAdminAccess();
    }catch(error){
      await signOutAdmin({silent:true});
      if(/No active Animo organizer access/i.test(error.message)){
        throw new Error("This Supabase account is valid, but it does not have active Animo organizer access.");
      }
      throw error;
    }

    recordAdminActivity("Authentication","Signed in",{
      status:supabaseAccessProfile?.status||"Active",
      permissions:Array.isArray(supabaseAccessProfile?.permissions)?supabaseAccessProfile.permissions.length:0
    },{source:"Supabase Auth"});
    return supabaseAccessProfile;
  }

  async function signOutAdmin({silent=false}={}){
    if(!silent&&supabaseAccessProfile){
      recordAdminActivity("Authentication","Signed out",{},{
        source:"Supabase Auth",
        target:supabaseAccessProfile?.email||supabaseSession?.user?.email||"Organizer"
      });
    }
    const token=supabaseSession?.access_token;
    if(token){
      try{
        await supabaseRequest("/auth/v1/logout",{
          method:"POST",
          accessToken:token
        });
      }catch(error){
        console.warn("Supabase logout request:",error);
      }
    }
    writeSupabaseSession(null);
    supabaseAccessProfile=null;
    if(!silent)lockAdmin("");
  }

  async function restoreAdminSession(){
    const saved=readStoredSupabaseSession();
    if(!saved)return false;
    writeSupabaseSession(saved);
    try{
      await loadMyAdminAccess();
      return true;
    }catch(error){
      console.warn("Could not restore organizer session:",error);
      writeSupabaseSession(null);
      supabaseAccessProfile=null;
      return false;
    }
  }

  function bindAuthUi(){
    const form=$("#adminLoginForm");
    if(form){
      form.addEventListener("submit",async event=>{
        event.preventDefault();
        const email=String($("#adminLoginEmail")?.value||"").trim().toLowerCase();
        const password=String($("#adminLoginPassword")?.value||"");
        if(!email||!password){
          authStatus("Enter your organizer email and password.","error");
          return;
        }

        authStatus("");
        setAuthLoading(true);
        try{
          const profile=await signInAdmin(email,password);
          adminTab=firstAccessibleTab();
          unlockAdmin();
          renderAdmin();
          showToast(`Signed in as ${profile.display_name||profile.role?.name||"Organizer"}`);
        }catch(error){
          console.warn(error);
          let message=error.message||"Sign in failed.";
          if(/invalid login credentials/i.test(message))message="Incorrect email or password.";
          if(/email not confirmed/i.test(message))message="This organizer email has not been confirmed in Supabase yet.";
          authStatus(message,"error");
        }finally{
          setAuthLoading(false);
        }
      });
    }

    const toggle=$("#toggleAdminPassword");
    if(toggle){
      toggle.onclick=()=>{
        const input=$("#adminLoginPassword");
        if(!input)return;
        const show=input.type==="password";
        input.type=show?"text":"password";
        toggle.textContent=show?"Hide":"Show";
        toggle.setAttribute("aria-label",show?"Hide password":"Show password");
      };
    }

    const logout=$("#adminLogoutButton");
    if(logout){
      logout.onclick=async()=>{
        logout.disabled=true;
        try{
          await signOutAdmin();
          $("#adminLoginPassword").value="";
          authStatus("You have been signed out.","success");
        }finally{
          logout.disabled=false;
        }
      };
    }
  }

  async function initializeAuthenticatedAdmin(){
    if(authInitializing)return;
    authInitializing=true;
    bindAuthUi();

    getAccessControl();
    getEmailNotificationSettings();
    loadAdminConfig();
    reconcileAllRecords();
    adminDraft=structuredClone(config);

    const restored=await restoreAdminSession();
    if(restored){
      adminTab=firstAccessibleTab();
      unlockAdmin();
      bindGlobal();
      renderAdmin();
    }else{
      lockAdmin("");
      bindGlobal();
      const email=$("#adminLoginEmail");
      if(email)setTimeout(()=>email.focus(),50);
    }

    authInitializing=false;
  }

  function defaultEmailNotificationSettings(){
    const sender=config.name||"Animo Pickleball Cup 2026";
    const replyTo=String(config.contact?.email||"").trim();
    return {
      enabled:true,
      senderName:sender,
      replyTo:replyTo&& !placeholder(replyTo)?replyTo:"",
      footer:"This is an automated tournament registration update from Animo Pickleball Cup 2026.",
      templates:[
        {
          id:"registration_received",
          enabled:true,
          label:"Registration Received",
          trigger:"When a player submits a registration",
          recipients:"Player 1 and Player 2 when both emails are available",
          subject:"We received your Animo registration — {{registration_reference}}",
          headline:"Registration received",
          body:"Hi {{player_name}},\n\nWe received your registration for {{event_name}}.\n\nDivision: {{division}}\nRegistration reference: {{registration_reference}}\n\nThe organizer will review your player details, level information, and payment proof before approval.",
          ctaLabel:"Check Registration Status",
          ctaUrl:"{{status_link}}",
          tone:"received"
        },
        {
          id:"partner_invitation",
          enabled:true,
          label:"Partner Invitation",
          trigger:"When Player 1 chooses Invite Partner",
          recipients:"Invited Player 2",
          subject:"Complete your Animo tournament registration",
          headline:"Your partner invited you",
          body:"Hi {{player_name}},\n\n{{partner_name}} started a registration for {{event_name}} and listed you as their partner.\n\nComplete your player details so Animo can determine the pair's final level and doubles division.",
          ctaLabel:"Complete My Details",
          ctaUrl:"{{partner_link}}",
          tone:"action"
        },
        {
          id:"payment_received",
          enabled:true,
          label:"Payment Proof Received",
          trigger:"When payment proof is submitted",
          recipients:"Registered players",
          subject:"Payment proof received — {{registration_reference}}",
          headline:"We received your payment proof",
          body:"Hi {{player_name}},\n\nYour payment proof has been attached to registration {{registration_reference}}.\n\nThe organizer will review it together with the rest of your registration details.",
          ctaLabel:"Check Registration Status",
          ctaUrl:"{{status_link}}",
          tone:"received"
        },
        {
          id:"level_validation",
          enabled:true,
          label:"Level Verification",
          trigger:"When the registration requires organizer level validation",
          recipients:"Affected player and registration contact",
          subject:"Animo is verifying your playing level",
          headline:"Playing level verification in progress",
          body:"Hi {{player_name}},\n\nWe are reviewing the DUPR proof, club information, or playing history submitted for registration {{registration_reference}}.\n\nThis validation helps keep every tournament division fair. No action is needed unless the organizer contacts you.",
          ctaLabel:"View Status",
          ctaUrl:"{{status_link}}",
          tone:"verification"
        },
        {
          id:"action_required",
          enabled:true,
          label:"Action Required",
          trigger:"When the organizer requests new proof or additional information",
          recipients:"Affected player",
          subject:"Action required for your Animo registration",
          headline:"We need one more thing from you",
          body:"Hi {{player_name}},\n\nThe organizer needs additional information before registration {{registration_reference}} can continue.\n\nReason: {{action_reason}}\n\nPlease provide the requested information as soon as possible.",
          ctaLabel:"Review My Registration",
          ctaUrl:"{{status_link}}",
          tone:"action"
        },
        {
          id:"level_updated",
          enabled:true,
          label:"Level / Division Updated",
          trigger:"When the organizer reclassifies a player or changes the final division",
          recipients:"Both registered players",
          subject:"Your Animo tournament placement was updated",
          headline:"Your tournament placement has changed",
          body:"Hi {{player_name}},\n\nThe organizer updated your tournament placement after reviewing the submitted eligibility information.\n\nPrevious level: {{previous_level}}\nCurrent level: {{level}}\nCurrent division: {{division}}\n\nPlease review the updated registration details.",
          ctaLabel:"View Updated Registration",
          ctaUrl:"{{status_link}}",
          tone:"verification"
        },
        {
          id:"approved",
          enabled:true,
          label:"Registration Accepted",
          trigger:"When the organizer approves the registration",
          recipients:"Both registered players",
          subject:"Your Animo registration has been accepted",
          headline:"Registration accepted",
          body:"Hi {{player_name}},\n\nYour registration for {{event_name}} has passed organizer review.\n\nDivision: {{division}}\nRegistration reference: {{registration_reference}}\n\nWe are completing the final confirmation of your tournament entry.",
          ctaLabel:"View Registration",
          ctaUrl:"{{status_link}}",
          tone:"approved"
        },
        {
          id:"confirmed",
          enabled:true,
          label:"Officially Confirmed",
          trigger:"When the registration is marked Confirmed",
          recipients:"Both registered players",
          subject:"You're officially confirmed for {{event_name}}!",
          headline:"You're officially confirmed!",
          body:"Hi {{player_name}},\n\nYour tournament entry is confirmed.\n\nDivision: {{division}}\nDate: {{event_date}}\nVenue: {{venue}}\nRegistration reference: {{registration_reference}}\n\nSee you on tournament day!",
          ctaLabel:"View Confirmed Registration",
          ctaUrl:"{{status_link}}",
          tone:"confirmed"
        },
        {
          id:"rejected",
          enabled:true,
          label:"Registration Not Approved",
          trigger:"When the organizer rejects the registration",
          recipients:"Registration contact and affected players",
          subject:"Update on your Animo registration",
          headline:"Your registration was not approved",
          body:"Hi {{player_name}},\n\nThe organizer could not approve registration {{registration_reference}} based on the information currently on file.\n\nReason: {{decision_reason}}\n\nPlease contact the tournament organizer if you need clarification.",
          ctaLabel:"View Registration Status",
          ctaUrl:"{{status_link}}",
          tone:"rejected"
        },
        {
          id:"cancelled",
          enabled:true,
          label:"Registration Cancelled",
          trigger:"When a registration is cancelled",
          recipients:"Both registered players",
          subject:"Your Animo registration was cancelled",
          headline:"Registration cancelled",
          body:"Hi {{player_name}},\n\nRegistration {{registration_reference}} for {{event_name}} has been cancelled.\n\nIf this was unexpected, please contact the tournament organizer.",
          ctaLabel:"View Registration Status",
          ctaUrl:"{{status_link}}",
          tone:"cancelled"
        }
      ]
    };
  }

  function normalizeEmailNotificationSettings(value){
    const fallback=defaultEmailNotificationSettings();
    const savedTemplates=new Map((Array.isArray(value?.templates)?value.templates:[]).map(t=>[t.id,t]));
    const templates=fallback.templates.map(template=>{
      const saved=savedTemplates.get(template.id)||{};
      return {
        ...template,
        enabled:saved.enabled===undefined?template.enabled:!!saved.enabled,
        subject:String(saved.subject??template.subject),
        headline:String(saved.headline??template.headline),
        body:String(saved.body??template.body),
        ctaLabel:String(saved.ctaLabel??template.ctaLabel),
        ctaUrl:String(saved.ctaUrl??template.ctaUrl)
      };
    });
    return {
      enabled:value?.enabled===undefined?fallback.enabled:!!value.enabled,
      senderName:String(value?.senderName??fallback.senderName),
      replyTo:String(value?.replyTo??fallback.replyTo),
      footer:String(value?.footer??fallback.footer),
      templates
    };
  }

  function getEmailNotificationSettings(){
    try{
      const raw=localStorage.getItem(EMAIL_NOTIFICATION_KEY);
      if(raw)return normalizeEmailNotificationSettings(JSON.parse(raw));
    }catch(e){console.warn(e)}
    const fresh=defaultEmailNotificationSettings();
    try{localStorage.setItem(EMAIL_NOTIFICATION_KEY,JSON.stringify(fresh))}catch(e){}
    return fresh;
  }

  function saveEmailNotificationSettings(settings,toastMessage="Notification settings saved"){
    const normalized=normalizeEmailNotificationSettings(settings);
    localStorage.setItem(EMAIL_NOTIFICATION_KEY,JSON.stringify(normalized));
    if(toastMessage)showToast(toastMessage);
    return normalized;
  }

  function emailTemplateById(id){
    return getEmailNotificationSettings().templates.find(t=>t.id===id)||getEmailNotificationSettings().templates[0];
  }

  function emailSampleData(){
    return {
      "{{player_name}}":"Juan Dela Cruz",
      "{{partner_name}}":"Maria Santos",
      "{{event_name}}":config.name||"Animo Pickleball Cup 2026",
      "{{registration_reference}}":"APC26-1024",
      "{{division}}":"Low Intermediate — Mixed Doubles",
      "{{level}}":"Low Intermediate",
      "{{previous_level}}":"Beginner",
      "{{event_date}}":config.eventDate?new Date(`${config.eventDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}):"Tournament date",
      "{{venue}}":config.venue||"Tournament venue",
      "{{action_reason}}":"Please upload a clearer DUPR screenshot showing your name and current rating.",
      "{{decision_reason}}":"The submitted playing information did not support the requested tournament level.",
      "{{status_link}}":"https://animo.example/status",
      "{{partner_link}}":"https://animo.example/partner"
    };
  }

  function renderEmailTokens(text){
    let out=String(text||"");
    Object.entries(emailSampleData()).forEach(([token,value])=>{out=out.split(token).join(value)});
    return out;
  }

  function getEmailActivity(){
    try{
      const value=JSON.parse(localStorage.getItem(EMAIL_ACTIVITY_KEY)||"[]");
      return Array.isArray(value)?value:[];
    }catch{return []}
  }

  function saveEmailActivity(rows){
    try{localStorage.setItem(EMAIL_ACTIVITY_KEY,JSON.stringify((Array.isArray(rows)?rows:[]).slice(0,250)))}catch(e){}
  }

  function emailPlayerName(player){
    return [player?.firstName,player?.middleName,player?.lastName].filter(Boolean).join(" ").trim()||"Player";
  }

  function emailRecipientsFor(record,templateId,context={}){
    const recipients=[];
    const add=(slot,player)=>{
      const email=String(player?.email||"").trim().toLowerCase();
      recipients.push({
        slot,
        name:emailPlayerName(player),
        email
      });
    };

    if(templateId==="partner_invitation"){
      add("Player 2",record?.player2||{});
      return recipients;
    }

    if(templateId==="action_required"&&context.slot){
      const player=context.slot==="verification2"?record?.player2:record?.player1;
      add(context.slot==="verification2"?"Player 2":"Player 1",player||{});
      return recipients;
    }

    add("Player 1",record?.player1||{});
    if(record?.registrationType==="pair"||record?.registrationType==="invite"){
      add("Player 2",record?.player2||{});
    }

    const seen=new Set();
    return recipients.filter(recipient=>{
      const key=recipient.email||`${recipient.slot}-${recipient.name}`;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  function notificationContextText(templateId,context={}){
    if(templateId==="confirmed")return "Registration changed to Confirmed";
    if(templateId==="approved")return "Registration changed to Approved";
    if(templateId==="rejected")return "Registration changed to Rejected";
    if(templateId==="cancelled")return "Registration changed to Cancelled";
    if(templateId==="level_validation")return "Registration entered level verification";
    if(templateId==="action_required")return context.reason||"Organizer requested additional information";
    if(templateId==="level_updated")return context.reason||"Tournament placement was updated";
    if(templateId==="payment_received")return "Payment proof was received";
    if(templateId==="registration_received")return "Registration was submitted";
    if(templateId==="partner_invitation")return "Partner invitation was created";
    return context.reason||"Registration event";
  }

  function triggerEmailNotification(record,templateId,context={}){
    if(!record)return {triggered:0,skipped:0};
    const settings=getEmailNotificationSettings();
    const template=settings.templates.find(t=>t.id===templateId);
    if(!template)return {triggered:0,skipped:0};

    const recipients=emailRecipientsFor(record,templateId,context);
    const activity=getEmailActivity();
    const now=new Date().toISOString();
    let triggered=0,skipped=0;

    if(!recipients.length){
      activity.unshift({
        id:`email-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        at:now,
        reference:record.reference||"—",
        templateId,
        templateLabel:template.label,
        recipientName:"No recipient",
        recipientEmail:"",
        result:"Skipped",
        detail:"No eligible player recipient was found.",
        source:notificationContextText(templateId,context),
        preview:true
      });
      skipped++;
    }else{
      recipients.forEach(recipient=>{
        let result="Triggered";
        let detail="Automatic trigger recorded. Email delivery will occur after backend integration.";

        if(!settings.enabled){
          result="Suppressed";
          detail="Master email notifications are disabled.";
          skipped++;
        }else if(!template.enabled){
          result="Suppressed";
          detail=`${template.label} notification is disabled.`;
          skipped++;
        }else if(!recipient.email){
          result="Skipped";
          detail=`${recipient.slot} does not have an email address on file.`;
          skipped++;
        }else{
          triggered++;
        }

        activity.unshift({
          id:`email-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          at:now,
          reference:record.reference||"—",
          templateId,
          templateLabel:template.label,
          recipientName:recipient.name,
          recipientEmail:recipient.email,
          recipientSlot:recipient.slot,
          result,
          detail,
          source:notificationContextText(templateId,context),
          preview:true
        });
      });
    }

    saveEmailActivity(activity);
    return {triggered,skipped};
  }

  function triggerStatusEmail(record,oldStatus,newStatus){
    if(!record||oldStatus===newStatus)return {triggered:0,skipped:0};
    const map={
      "Pending Level Validation":"level_validation",
      "Pending Level Verification":"level_validation",
      "Payment Submitted":"payment_received",
      "Approved":"approved",
      "Confirmed":"confirmed",
      "Rejected":"rejected",
      "Cancelled":"cancelled"
    };
    const templateId=map[newStatus];
    if(!templateId)return {triggered:0,skipped:0};
    return triggerEmailNotification(record,templateId,{oldStatus,newStatus});
  }

  function emailActivityStatusClass(result){
    return String(result||"").toLowerCase().replace(/[^a-z0-9]+/g,"-");
  }

  function clearEmailPreviewActivity(){
    if(!can("notifications.manage"))return;
    if(!confirm("Clear the preview email activity log?"))return;
    saveEmailActivity([]);
    renderAdmin();
    showToast("Preview email activity cleared");
  }

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const esc = (v="") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const placeholder = v => /^\[.+\]$/.test(String(v||"").trim());
  const adminDisplayValue = value => placeholder(value) ? "" : (value ?? "");
  const normalizeMobile = value => String(value||"").replace(/\D/g,"").replace(/^63(?=9\d{9}$)/,"0");
  const formatMoney = value => new Intl.NumberFormat("en-PH",{style:"currency",currency:config.currency||"PHP",maximumFractionDigits:0}).format(Number(value)||0);
  const getDivision = id => config.divisions.find(d=>d.id===id);
  const fullName = p => [p?.firstName,p?.lastName].filter(Boolean).join(" ") || "—";
  const duprText = v => {
    if(v?.hasDupr==="No"){
      return v?.organizerAssignedLevel&&v?.manualLevelApproved
        ? `No DUPR · Validated ${levelLabel(v.organizerAssignedLevel)}`
        : v?.requestedLevel
          ? `No DUPR · Requested ${levelLabel(v.requestedLevel)} · Pending validation`
          : "No DUPR · Requested level missing";
    }
    if(v?.hasDupr!=="Yes")return "DUPR status incomplete";
    const level=classifyDuprRating(v.duprRating);
    return [
      v.duprRating?`Rating ${Number(v.duprRating).toFixed(2)}`:"",
      level?.label?`Level ${level.label}`:"",
      v.duprProofName?`Proof ${v.duprProofStatus||"Pending Verification"}`:"Proof missing",
      v.duprId||""
    ].filter(Boolean).join(" · ")||"DUPR declared";
  };
  function duprThresholds(){
    const t=config.duprEligibility?.thresholds||{};
    return {lowIntermediateMin:Number(t.lowIntermediateMin??3),highIntermediateMin:Number(t.highIntermediateMin??3.5),advancedMin:Number(t.advancedMin??4)};
  }
  function levelLabel(key){
    return config.duprEligibility?.labels?.[key]||({beginner:"Beginner",lowIntermediate:"Low Intermediate",highIntermediate:"High Intermediate",advanced:"Advanced"}[key])||"Manual Level Verification";
  }
  function levelRank(key){return ({beginner:1,lowIntermediate:2,highIntermediate:3,advanced:4})[key]||0}
  function classifyDuprRating(value){
    if(value==null||value===""||!Number.isFinite(Number(value))||Number(value)<=0)return null;
    const rating=Number(value),t=duprThresholds();
    const levelKey=rating>=t.advancedMin?"advanced":rating>=t.highIntermediateMin?"highIntermediate":rating>=t.lowIntermediateMin?"lowIntermediate":"beginner";
    return {rating,levelKey,label:levelLabel(levelKey)};
  }
  function playerAssessment(v){
    if(v?.hasDupr==="No"){
      const validated=v?.organizerAssignedLevel||null;
      if(validated&&v?.manualLevelApproved)return {levelKey:validated,label:levelLabel(validated),rating:null,manual:false,classificationPending:false,source:"organizer-validated"};
      const requested=v?.requestedLevel||null;
      return {levelKey:requested,label:requested?levelLabel(requested):"Requested level missing",rating:null,manual:true,classificationPending:!requested,source:"player-declared"};
    }
    if(v?.hasDupr==="Yes"){
      const level=classifyDuprRating(v.duprRating);
      if(!level)return {levelKey:null,label:"DUPR incomplete",rating:null,manual:true,classificationPending:true,source:"DUPR"};
      return {...level,manual:v?.duprProofStatus!=="Verified",classificationPending:false,source:"DUPR"};
    }
    return {levelKey:null,label:"Level information incomplete",rating:null,manual:true,classificationPending:true,source:""};
  }
  function divisionCategoryKey(d){
    const id=String(d?.id||"").toLowerCase();
    const text=`${d?.classification||""} ${d?.name||""}`.toLowerCase();
    if(id.endsWith("-mixed")||text.includes("mixed"))return "mixed";
    if(id.endsWith("-women")||text.includes("women"))return "women";
    if(id.endsWith("-men")||text.includes("men's")||text.includes(" men"))return "men";
    return "";
  }
  function categoryLabel(key){return ({men:"Men's Doubles",women:"Women's Doubles",mixed:"Mixed Doubles"})[key]||"Category verification required"}
  function recordCategory(r){
    if(r?.organizerCategory)return {categoryKey:r.organizerCategory,label:categoryLabel(r.organizerCategory),pending:false,source:"organizer"};
    if(r?.registrationType!=="pair")return {categoryKey:null,label:"Category pending",pending:true,source:""};
    const g1=r?.player1?.gender,g2=r?.player2?.gender;
    if(g1==="Male"&&g2==="Male")return {categoryKey:"men",label:"Men's Doubles",pending:false,source:"automatic"};
    if(g1==="Female"&&g2==="Female")return {categoryKey:"women",label:"Women's Doubles",pending:false,source:"automatic"};
    if((g1==="Male"&&g2==="Female")||(g1==="Female"&&g2==="Male"))return {categoryKey:"mixed",label:"Mixed Doubles",pending:false,source:"automatic"};
    return {categoryKey:null,label:"Category verification required",pending:true,source:""};
  }
  function recordEligibility(r){
    const partnerPending=["invite","existing"].includes(r?.registrationType);
    const players=[{playerLabel:"Player 1",v:r?.verification1}];
    if(r?.registrationType==="pair")players.push({playerLabel:"Player 2",v:r?.verification2});
    const assessed=players.map(x=>({...x,...playerAssessment(x.v)}));
    if(partnerPending){
      return {levelKey:null,label:"Partner verification pending",rating:null,controller:"",manualReview:true,partnerPending:true,classificationPending:true,levelMismatch:false,categoryPending:true,categoryKey:null,categoryLabel:"Pending partner",source:"",divisionId:null,readyForApproval:false};
    }
    if(r?.registrationType!=="pair"){
      return {levelKey:null,label:"Partner assignment pending",rating:null,controller:"",manualReview:true,partnerPending:false,classificationPending:true,levelMismatch:false,categoryPending:true,categoryKey:null,categoryLabel:"Pending partner",source:"",divisionId:null,readyForApproval:false};
    }
    if(assessed.some(x=>!x.levelKey)){
      return {levelKey:null,label:"Level information required",rating:null,controller:"",manualReview:true,partnerPending:false,classificationPending:true,levelMismatch:false,categoryPending:false,categoryKey:null,categoryLabel:"Pending",source:"",divisionId:null,readyForApproval:false};
    }
    if(assessed[0].levelKey!==assessed[1].levelKey){
      return {levelKey:null,label:"Partner Level Mismatch",rating:null,controller:"",manualReview:true,partnerPending:false,classificationPending:false,levelMismatch:true,categoryPending:false,categoryKey:null,categoryLabel:"—",source:"",player1Level:assessed[0].levelKey,player2Level:assessed[1].levelKey,divisionId:null,readyForApproval:false};
    }
    const category=recordCategory(r);
    const levelKey=assessed[0].levelKey;
    const exact=config.divisions.find(d=>d.enabled&&d.levelKey===levelKey&&divisionCategoryKey(d)===category.categoryKey);
    const ratings=assessed.map(x=>x.rating).filter(v=>v!=null).map(Number);
    const manualReview=assessed.some(x=>x.manual)||category.pending;
    const readyForApproval=!manualReview&&!category.pending&&!!exact;
    return {levelKey,label:levelLabel(levelKey),rating:ratings.length?Math.max(...ratings):null,controller:"",manualReview,partnerPending:false,classificationPending:false,levelMismatch:false,categoryPending:category.pending,categoryKey:category.categoryKey,categoryLabel:category.label,source:assessed.some(x=>x.source==="organizer-validated")?"organizer-validated":assessed.some(x=>x.source==="player-declared")?"player-declared":"DUPR",divisionId:exact?.id||null,readyForApproval};
  }
  function playerLevel(v){
    const p=playerAssessment(v);
    return p.levelKey?levelLabel(p.levelKey):p.label||"Level information required";
  }
  function showToast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove("show"),2200)}
  function getRecords(){try{return JSON.parse(localStorage.getItem(RECORDS_KEY)||"[]")}catch{return []}}
  function saveRecords(records){localStorage.setItem(RECORDS_KEY,JSON.stringify(records))}
  function loadAdminConfig(){try{const raw=localStorage.getItem(ADMIN_CONFIG_KEY);if(raw)Object.assign(config,JSON.parse(raw))}catch(e){console.warn(e)}}
  function persistAdminConfig(){try{localStorage.setItem(ADMIN_CONFIG_KEY,JSON.stringify(config));return true}catch(e){console.warn(e);return false}}
  function nl2br(value){return esc(value).replace(/\n/g,"<br>")}

  function renderAdmin(){
    const required=TAB_PERMISSIONS[adminTab];
    if(required&&!can(required))adminTab=firstAccessibleTab();

    refreshAccessChrome();
    $$(".admin-tab").forEach(btn=>btn.classList.toggle("active",btn.dataset.adminTab===adminTab));
    const panel=$("#adminPanel");
    if(adminTab==="registrations") panel.innerHTML=renderRegistrations();
    if(adminTab==="reports") panel.innerHTML=renderAdminReports();
    if(adminTab==="details") panel.innerHTML=renderAdminDetails();
    if(adminTab==="divisions") panel.innerHTML=renderAdminDivisions();
    if(adminTab==="dupr") panel.innerHTML=renderAdminDuprRules();
    if(adminTab==="hero") panel.innerHTML=renderAdminHero();
    if(adminTab==="faq") panel.innerHTML=renderAdminFaq();
    if(adminTab==="contact") panel.innerHTML=renderAdminContact();
    if(adminTab==="notifications") panel.innerHTML=renderAdminNotifications();
    if(adminTab==="activity") panel.innerHTML=renderAdminActivity();
    if(adminTab==="backup") panel.innerHTML=renderAdminBackup();
    if(adminTab==="access") panel.innerHTML=renderAdminAccess();
    bindPanel();
    refreshAccessChrome();
  }

  function registrationStats(records){
    const active=records.filter(r=>!r.deleted);
    const count=s=>active.filter(r=>r.status===s).length;
    return {total:active.length,submitted:active.filter(r=>["Submitted","Payment Submitted","Awaiting Partner"].includes(r.status)).length,pending:active.filter(r=>["Pending","Pending Level Validation","Pending Level Verification"].includes(r.status)).length,approved:count("Approved"),confirmed:count("Confirmed")};
  }
  function filteredRecords(){
    return getRecords().filter(r=>!r.deleted).filter(r=>statusFilter==="all"||r.status===statusFilter).filter(r=>divisionFilter==="all"||(r.divisions||[]).includes(divisionFilter)).filter(r=>{
      if(!searchTerm)return true;
      const hay=[r.reference,fullName(r.player1),fullName(r.player2),r.player1?.email,r.player1?.mobile,r.verification1?.clubAffiliation,r.verification2?.clubAffiliation,r.verification1?.duprRating,r.verification2?.duprRating,recordEligibility(r).label].join(" ").toLowerCase();
      return hay.includes(searchTerm.toLowerCase());
    }).sort((a,b)=>String(b.submittedAt||"").localeCompare(String(a.submittedAt||"")));
  }
  function renderRegistrations(){
    const all=getRecords(); const s=registrationStats(all); const records=filteredRecords();
    const statuses=["Submitted","Payment Submitted","Awaiting Partner","Pending Level Validation","Pending","Approved","Confirmed","Rejected","Cancelled"];
    return `<div class="admin-panel-heading"><div><p class="eyebrow">Registration operations</p><h2>Registration Requests</h2><p>Review player details, verify level information, enforce same-level partner rules, and approve tournament entries.</p></div></div>
      <div class="admin-stat-grid">
        ${statCard("All requests",s.total)}${statCard("New / submitted",s.submitted)}${statCard("Pending",s.pending)}${statCard("Approved",s.approved)}${statCard("Confirmed",s.confirmed)}
      </div>
      <div class="admin-filter-bar">
        <label class="field"><span>Search</span><input id="recordSearch" value="${esc(searchTerm)}" placeholder="Name, reference, email, club" /></label>
        <label class="field"><span>Status</span><select id="statusFilter"><option value="all">All statuses</option>${statuses.map(x=>`<option value="${esc(x)}" ${x===statusFilter?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
        <label class="field"><span>Division</span><select id="divisionFilter"><option value="all">All divisions</option>${config.divisions.filter(d=>d.enabled).map(d=>`<option value="${esc(d.id)}" ${d.id===divisionFilter?"selected":""}>${esc(d.name)}</option>`).join("")}</select></label>
      </div>
      <div class="registration-admin-list">
      ${records.length?records.map(recordCard).join(""):`<div class="empty-state"><strong>No registration requests found.</strong>Records submitted in this browser will appear here during preview testing.</div>`}
      </div>`;
  }
  function statCard(label,value){return `<article class="admin-stat-card"><span>${esc(label)}</span><strong>${Number(value).toLocaleString("en-PH")}</strong></article>`}
  function recordCard(r){
    const eligibility=recordEligibility(r);
    const divs=(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(", ");
    const p2=r.registrationType==="pair"?fullName(r.player2):r.registrationType==="invite"?`Invite: ${fullName(r.player2)}`:r.registrationType==="existing"?`Partner ref: ${r.partnerReference||"—"}`:"Individual";
    const warning=eligibility.levelMismatch?"Level mismatch":eligibility.classificationPending?"Classification pending":eligibility.categoryPending?"Category pending":eligibility.manualReview?"Verification pending":"Ready";
    return `<article class="registration-admin-card">
      <div class="registration-admin-main"><div class="registration-admin-title"><span class="status-pill">${esc(r.status||"Submitted")}</span>${eligibility.manualReview?`<span class="status-pill warning-pill">${esc(warning)}</span>`:""}<strong>${esc(r.reference||"No reference")}</strong></div><h3>${esc(fullName(r.player1))}</h3><p>${esc(p2)} · ${esc(divs||"No division assigned")}</p><div class="eligibility-admin-line"><strong>${esc(eligibility.label)}</strong><span>${esc(eligibility.categoryLabel||"Category pending")}</span></div><small>${r.submittedAt?esc(new Date(r.submittedAt).toLocaleString("en-PH")):"Date unavailable"}</small></div>
      <div class="registration-admin-actions"><button class="button button-ghost" data-view-record="${esc(r.reference)}" type="button">View</button>${canAny("registrations.status","registrations.approve","registrations.confirm","registrations.reject")?`<select data-status-record="${esc(r.reference)}" aria-label="Update registration status">${permittedStatusOptions(r).map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select>`:""}</div>
    </article>`;
  }
  function verificationStatusText(v){
    if(v?.hasDupr==="Yes")return v?.duprProofStatus||"Pending Verification";
    if(v?.hasDupr==="No")return v?.organizerAssignedLevel&&v?.manualLevelApproved?`Validated ${levelLabel(v.organizerAssignedLevel)}`:v?.requestedLevel?`Requested ${levelLabel(v.requestedLevel)} · Pending validation`:"Requested level missing";
    return "Incomplete";
  }
  function proofMarkup(v){
    if(v?.hasDupr!=="Yes")return "";
    if(v?.duprProofDataUrl){
      return `<div class="admin-proof-preview"><img src="${esc(v.duprProofDataUrl)}" alt="DUPR screenshot proof"/><div><strong>${esc(v.duprProofName||"DUPR screenshot")}</strong><span>${esc(v.duprProofStatus||"Pending Verification")}</span><a href="${esc(v.duprProofDataUrl)}" target="_blank" rel="noopener">View full screenshot</a></div></div>`;
    }
    return `<div class="admin-warning-box"><strong>DUPR proof: ${esc(v?.duprProofName||"Missing")}</strong><p>${v?.duprProofName?"The record contains proof metadata, but the image payload is not available in this browser.":"No DUPR screenshot was provided."}</p></div>`;
  }
  function verificationActions(reference,slot,v){
    const actions=[];
    if(v?.hasDupr==="Yes"){
      if(can("eligibility.verify")){
        actions.push(`<button class="button button-ghost" data-verify-dupr="${slot}" data-record="${esc(reference)}" type="button">Verify DUPR</button>`);
        actions.push(`<button class="button button-ghost" data-request-proof="${slot}" data-record="${esc(reference)}" type="button">Request New Proof</button>`);
      }
      if(can("eligibility.reclassify")){
        actions.push(`<button class="button button-ghost" data-correct-dupr="${slot}" data-record="${esc(reference)}" type="button">Correct Rating</button>`);
      }
    }
    if(v?.hasDupr==="No"&&can("eligibility.reclassify")){
      actions.push(`<button class="button button-ghost" data-change-manual="${slot}" data-record="${esc(reference)}" type="button">${v?.organizerAssignedLevel?"Change Validated Level":"Change Requested Level"}</button>`);
    }
    return actions.length?`<div class="verification-actions">${actions.join("")}</div>`:"";
  }
  function openRecord(reference){
    const r=getRecords().find(x=>x.reference===reference); if(!r)return;
    const eligibility=recordEligibility(r);
    const divs=(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(", ")||"Pending";
    const playerBlock=(label,p,v,slot)=>{
      const assigned=v?.hasDupr==="No"?(v?.organizerAssignedLevel?levelLabel(v.organizerAssignedLevel):"Not yet validated"):"—";
      return `<section class="record-detail-section"><p class="eyebrow">${esc(label)}</p><h3>${esc(fullName(p))}</h3><div class="record-detail-grid">${detail("Date of birth",p?.birthDate)}${detail("Gender",p?.gender)}${detail("Email",p?.email)}${detail("Mobile",p?.mobile)}${detail("Club affiliation",v?.clubAffiliation)}${detail("DUPR status",v?.hasDupr||"—")}${detail("DUPR profile / ID",v?.duprId)}${detail("DUPR rating",v?.duprRating?Number(v.duprRating).toFixed(2):v?.hasDupr==="No"?"No rating":"—")}${v?.hasDupr==="No"?detail("Requested level",v?.requestedLevel?levelLabel(v.requestedLevel):"—"):""}${detail("Organizer-validated level",assigned)}${detail("System / provisional level",playerLevel(v))}${detail("Verification status",verificationStatusText(v))}${detail("Jersey back name",v?.jerseyName)}</div>${v?.hasDupr==="No"?`<div class="admin-note-block"><span>Club DUPR / Facebook page</span><p>${v?.verificationReference?`<a href="${esc(v.verificationReference)}" target="_blank" rel="noopener">${esc(v.verificationReference)}</a>`:"—"}</p></div><div class="admin-note-block"><span>Playing background & recent tournament history</span><p>${esc(v?.playingBackground||"—")}</p></div>`:""}${proofMarkup(v)}${verificationActions(reference,slot,v)}</section>`;
    };
    const issue=eligibility.levelMismatch
      ? `<div class="admin-warning-box"><strong>Partner level mismatch</strong><p>Player 1 and Player 2 are not classified in the same tournament level. Do not approve or confirm until this is resolved.</p></div>`
      : eligibility.classificationPending
      ? `<div class="admin-warning-box"><strong>Level information incomplete</strong><p>At least one player is missing the level information required to determine the team division.</p></div>`
      : eligibility.categoryPending
      ? `<div class="admin-warning-box"><strong>Category verification required</strong><p>A legacy or incomplete record does not contain Male/Female values for both players. Complete the gender data before approval.</p>${can("eligibility.reclassify")?`<button class="button button-ghost" data-set-category="${esc(reference)}" type="button">Assign Category</button>`:""}</div>`
      : eligibility.manualReview
      ? `<div class="admin-warning-box"><strong>Validation still required</strong><p>Review the supporting information. For no-DUPR players, approving the registration validates the requested level unless you change it first. DUPR screenshots must still be verified explicitly.</p></div>`
      : `<div class="admin-note-block"><span>Placement status</span><p>Same-level rule satisfied and category resolved automatically.</p></div>`;
    const paymentHeld=eligibility.classificationPending||eligibility.partnerPending||eligibility.categoryPending||eligibility.levelMismatch||!eligibility.divisionId;
    $("#recordModalBody").innerHTML=`<p class="eyebrow">Registration record</p><div class="record-modal-heading"><div><h2>${esc(r.reference||"Registration")}</h2><p>${esc(divs)}</p></div><span class="status-pill">${esc(r.status||"Submitted")}</span></div><section class="record-detail-section eligibility-record-section"><p class="eyebrow">Level & division verification</p><div class="record-detail-grid">${detail("Team level",eligibility.levelKey?levelLabel(eligibility.levelKey):eligibility.label)}${detail("Category",eligibility.categoryLabel||"Pending")}${detail("Assigned division",divs)}${detail("Same-level rule",eligibility.levelMismatch?"Failed":eligibility.classificationPending?"Pending":"Satisfied")}${detail("Organizer verification",eligibility.manualReview?"Required":"Complete")}</div>${issue}</section>${playerBlock("Player 1",r.player1,r.verification1,"verification1")}${r.registrationType==="pair"?playerBlock("Player 2",r.player2,r.verification2,"verification2"):""}<section class="record-detail-section"><p class="eyebrow">Payment</p><div class="record-detail-grid">${detail("Payment status",paymentHeld?"On hold until placement is resolved":"Eligible for payment")}${detail("Method",r.payment?.method)}${detail("Amount paid",r.payment?.amountPaid?formatMoney(r.payment.amountPaid):"—")}${detail("Reference",r.payment?.reference)}${detail("Sender",r.payment?.senderName)}${detail("Payment date",r.payment?.paymentDate)}${detail("Proof file",r.payment?.fileName)}</div></section><div class="record-modal-actions">${can("data.delete")?`<button class="button button-ghost danger-text" data-trash-record="${esc(r.reference)}" type="button">Move to Trash</button>`:""}${can("registrations.status")?`<button class="button button-primary" data-set-pending="${esc(r.reference)}" type="button">Mark Pending</button>`:""}${can("registrations.approve")?`<button class="button button-primary" data-set-approved="${esc(r.reference)}" type="button">Approve</button>`:""}${can("registrations.confirm")?`<button class="button button-primary" data-set-confirmed="${esc(r.reference)}" type="button">Confirm</button>`:""}</div>`;
    const modal=$("#recordModal");modal.showModal();
    $("[data-trash-record]",modal).onclick=()=>{updateRecord(reference,{deleted:true,deletedAt:new Date().toISOString()});recordAdminActivity("Registration","Moved registration to Trash",{}, {reference,target:reference});modal.close();renderAdmin();showToast("Moved to Trash")};
    $("[data-set-pending]",modal).onclick=()=>{updateStatus(reference,"Pending");modal.close()};
    $("[data-set-approved]",modal).onclick=()=>{updateStatus(reference,"Approved");modal.close()};
    $("[data-set-confirmed]",modal).onclick=()=>{updateStatus(reference,"Confirmed");modal.close()};
    $$("[data-verify-dupr]",modal).forEach(btn=>btn.onclick=()=>{updateVerification(reference,btn.dataset.verifyDupr,{duprProofStatus:"Verified"});modal.close();renderAdmin();openRecord(reference);showToast("DUPR verified")});
    $$("[data-request-proof]",modal).forEach(btn=>btn.onclick=()=>{updateVerification(reference,btn.dataset.requestProof,{duprProofStatus:"New Proof Requested"});modal.close();renderAdmin();openRecord(reference);showToast("New DUPR proof requested")});
    $$("[data-correct-dupr]",modal).forEach(btn=>btn.onclick=()=>correctDupr(reference,btn.dataset.correctDupr));
    $$("[data-change-manual]",modal).forEach(btn=>btn.onclick=()=>changeManualLevel(reference,btn.dataset.changeManual));
    const cat=$("[data-set-category]",modal);if(cat)cat.onclick=()=>assignCategory(reference);
  }
  function detail(label,value){return `<div><span>${esc(label)}</span><strong>${esc(value||"—")}</strong></div>`}
  function updateRecord(reference,changes){const records=getRecords();const i=records.findIndex(r=>r.reference===reference);if(i<0)return;records[i]={...records[i],...changes};saveRecords(records)}
  function reconcileRecordPlacement(record){
    if(!record)return record;
    const e=recordEligibility(record);
    record.divisions=e.divisionId?[e.divisionId]:[];
    record.paymentHeld=!!(e.classificationPending||e.partnerPending||e.categoryPending||e.levelMismatch||!e.divisionId);
    record.eligibilitySnapshot={
      levelKey:e.levelKey||null,
      levelLabel:e.levelKey?levelLabel(e.levelKey):e.label,
      controllingRating:e.rating??null,
      source:e.source||null,
      manualReview:!!e.manualReview,
      partnerPending:!!e.partnerPending,
      classificationPending:!!e.classificationPending,
      levelMismatch:!!e.levelMismatch,
      categoryPending:!!e.categoryPending,
      categoryKey:e.categoryKey||null,
      categoryLabel:e.categoryLabel||null,
      rule:"both partners must be in the same level; gender is Male/Female only and determines category automatically; no-DUPR players may request a level subject to organizer validation using a club DUPR/Facebook page link"
    };
    return record;
  }
  function reconcileAllRecords(){
    const records=getRecords();
    let changed=false;
    records.forEach(record=>{
      const before=JSON.stringify({divisions:record.divisions,paymentHeld:record.paymentHeld,eligibilitySnapshot:record.eligibilitySnapshot});
      reconcileRecordPlacement(record);
      const after=JSON.stringify({divisions:record.divisions,paymentHeld:record.paymentHeld,eligibilitySnapshot:record.eligibilitySnapshot});
      if(before!==after)changed=true;
    });
    if(changed)saveRecords(records);
  }
  function updateVerification(reference,slot,changes){
    if(!canAny("eligibility.verify","eligibility.reclassify")){showToast("Your role cannot change eligibility verification");return}
    const records=getRecords();const i=records.findIndex(r=>r.reference===reference);if(i<0)return;
    const record=records[i];
    const before=recordEligibility(record);
    const current=record[slot]||{};
    record[slot]={...current,...changes};
    record.verificationUpdatedAt=new Date().toISOString();
    reconcileRecordPlacement(record);
    const after=recordEligibility(record);
    saveRecords(records);

    const playerSlot=slot==="verification2"?"Player 2":"Player 1";
    let verificationAction="Updated eligibility information";
    if(changes?.duprProofStatus==="Verified")verificationAction="Verified DUPR proof";
    if(changes?.duprProofStatus==="New Proof Requested")verificationAction="Requested new DUPR proof";
    if(changes?.duprRating!==undefined)verificationAction="Corrected DUPR rating";
    if(changes?.organizerAssignedLevel!==undefined)verificationAction="Updated validated player level";
    recordAdminActivity("Eligibility",verificationAction,{
      player:playerSlot,
      levelBefore:before.levelKey?levelLabel(before.levelKey):"",
      levelAfter:after.levelKey?levelLabel(after.levelKey):"",
      divisionChanged:before.divisionId!==after.divisionId?"Yes":"No"
    },{reference,target:`${record.reference} · ${playerSlot}`});

    if(changes?.duprProofStatus==="New Proof Requested"){
      triggerEmailNotification(record,"action_required",{
        slot,
        reason:"Please submit updated DUPR proof so the organizer can continue validating your registration."
      });
    }else if(before.levelKey!==after.levelKey||before.divisionId!==after.divisionId){
      triggerEmailNotification(record,"level_updated",{
        slot,
        reason:"The organizer updated your playing level or tournament division after reviewing your eligibility information.",
        previousLevel:before.levelKey?levelLabel(before.levelKey):"",
        level:after.levelKey?levelLabel(after.levelKey):""
      });
    }
  }
  function correctDupr(reference,slot){
    if(!can("eligibility.reclassify")){showToast("Your role cannot reclassify players");return}
    const r=getRecords().find(x=>x.reference===reference);if(!r)return;
    const current=r?.[slot]?.duprRating||"";
    const raw=prompt("Enter the DUPR rating shown in the uploaded screenshot:",current);
    if(raw===null)return;
    const rating=Number(raw);
    if(!Number.isFinite(rating)||rating<=0||rating>8){showToast("Enter a valid DUPR rating");return}
    updateVerification(reference,slot,{duprRating:String(rating),duprProofStatus:"Verified"});
    const modal=$("#recordModal");if(modal.open)modal.close();renderAdmin();openRecord(reference);showToast("DUPR rating corrected and verified");
  }
  function changeManualLevel(reference,slot){
    if(!can("eligibility.reclassify")){showToast("Your role cannot reclassify players");return}
    const r=getRecords().find(x=>x.reference===reference);if(!r)return;
    const current=r?.[slot]?.organizerAssignedLevel||r?.[slot]?.requestedLevel||"beginner";
    const raw=prompt("Set validated tournament level: beginner, lowIntermediate, highIntermediate, or advanced",current);
    if(raw===null)return;
    const aliases={beginner:"beginner","lowintermediate":"lowIntermediate","low intermediate":"lowIntermediate","highintermediate":"highIntermediate","high intermediate":"highIntermediate",advanced:"advanced"};
    const key=aliases[String(raw).trim().toLowerCase()];
    if(!key){showToast("Level was not recognized");return}
    updateVerification(reference,slot,{organizerAssignedLevel:key,manualLevelApproved:true,manualLevelAssignedAt:new Date().toISOString()});
    const modal=$("#recordModal");if(modal.open)modal.close();renderAdmin();openRecord(reference);showToast(`Validated level set to ${levelLabel(key)}`);
  }
  function assignCategory(reference){
    if(!can("eligibility.reclassify")){showToast("Your role cannot change the player category");return}
    const records=getRecords();const i=records.findIndex(r=>r.reference===reference);if(i<0)return;
    const raw=prompt("Assign category: men, women, or mixed",records[i].organizerCategory||"mixed");
    if(raw===null)return;
    const aliases={"men":"men","men's":"men","mens":"men","women":"women","women's":"women","womens":"women","mixed":"mixed"};
    const key=aliases[String(raw).trim().toLowerCase()];
    if(!key){showToast("Category was not recognized");return}
    const before=recordEligibility(records[i]);
    records[i].organizerCategory=key;
    records[i].categoryAssignedAt=new Date().toISOString();
    reconcileRecordPlacement(records[i]);
    const after=recordEligibility(records[i]);
    saveRecords(records);
    recordAdminActivity("Eligibility","Assigned doubles category",{
      category:categoryLabel(key),
      divisionChanged:before.divisionId!==after.divisionId?"Yes":"No"
    },{reference,target:reference});
    if(before.categoryKey!==after.categoryKey||before.divisionId!==after.divisionId){
      triggerEmailNotification(records[i],"level_updated",{reason:"The organizer updated your doubles category or tournament division."});
    }
    const modal=$("#recordModal");if(modal.open)modal.close();renderAdmin();openRecord(reference);showToast(`Category assigned: ${categoryLabel(key)}`);
  }
  function updateStatus(reference,status){
    if(!can(statusPermission(status))){showToast("Your role cannot make that status change");return}
    const records=getRecords();
    const i=records.findIndex(r=>r.reference===reference);
    if(i<0)return;
    const record=records[i];
    if(["Approved","Confirmed"].includes(status)){
      let e=recordEligibility(record);
      if(e.classificationPending){showToast("Complete the missing requested level information first");return}
      if(e.levelMismatch){showToast("Partners must be in the same level before approval");return}
      if(e.categoryPending){showToast("Resolve the doubles category before approval");return}
      const verificationSlots=["verification1",...(record.registrationType==="pair"?["verification2"]:[])];
      const unverifiedDupr=verificationSlots.some(slot=>record?.[slot]?.hasDupr==="Yes"&&record?.[slot]?.duprProofStatus!=="Verified");
      if(unverifiedDupr){showToast("Verify all DUPR screenshots before approval");return}
      verificationSlots.forEach(slot=>{
        const v=record?.[slot];
        if(v?.hasDupr==="No"&&!v?.manualLevelApproved&&v?.requestedLevel){
          record[slot]={...v,organizerAssignedLevel:v.requestedLevel,manualLevelApproved:true,manualLevelAssignedAt:new Date().toISOString()};
        }
      });
      reconcileRecordPlacement(record);
      e=recordEligibility(record);
      if(e.levelMismatch){showToast("Validated player levels do not match");return}
      if(!e.divisionId){showToast("No matching division is assigned");return}
    }
    const oldStatus=record.status;
    record.status=status;
    record.statusUpdatedAt=new Date().toISOString();
    saveRecords(records);
    const emailResult=triggerStatusEmail(record,oldStatus,status);
    recordAdminActivity("Registration","Changed registration status",{
      from:oldStatus||"—",
      to:status,
      automaticEmails:emailResult.triggered||0
    },{reference,target:reference});
    renderAdmin();
    if(emailResult.triggered>0){
      showToast(`${status} saved · ${emailResult.triggered} player email${emailResult.triggered===1?"":"s"} automatically triggered (preview)`);
    }else{
      showToast(`Status updated to ${status}`);
    }
  }
  function adminField(label,path,value,type="text",helper=""){const shown=adminDisplayValue(value);return `<label class="field"><span>${esc(label)}</span><input type="${esc(type)}" data-admin-path="${esc(path)}" value="${esc(shown)}" ${type==="number"?'inputmode="decimal"':''}/>${helper?`<small>${esc(helper)}</small>`:""}</label>`}
  function adminTextarea(label,path,value,helper=""){return `<label class="field full"><span>${esc(label)}</span><textarea data-admin-path="${esc(path)}">${esc(adminDisplayValue(value))}</textarea>${helper?`<small>${esc(helper)}</small>`:""}</label>`}

  // =========================================================
  // REPORTS & INSIGHTS — registration BI workspace
  // =========================================================
  const reportPalette=["#0b4a34","#187c58","#7faa30","#d2aa3f","#76a99a","#52796f","#a56d45","#7667a8","#5478a8","#a95858","#9bae74","#455e57"];

  function reportKnownPlayers(record){
    const rows=[];
    if(record?.player1&&(record.player1.firstName||record.player1.lastName||record.player1.email)){
      rows.push({slot:"Player 1",player:record.player1,verification:record.verification1||{},record});
    }
    if(record?.registrationType==="pair"&&record?.player2&&(record.player2.firstName||record.player2.lastName||record.player2.email)){
      rows.push({slot:"Player 2",player:record.player2,verification:record.verification2||{},record});
    }
    return rows;
  }

  function reportAge(birthDate){
    if(!birthDate)return null;
    const dob=new Date(`${birthDate}T00:00:00`);
    const at=new Date(`${config.eventDate||new Date().toISOString().slice(0,10)}T00:00:00`);
    if(Number.isNaN(dob.getTime())||Number.isNaN(at.getTime())||dob>at)return null;
    let age=at.getFullYear()-dob.getFullYear();
    const beforeBirthday=(at.getMonth()<dob.getMonth())||(at.getMonth()===dob.getMonth()&&at.getDate()<dob.getDate());
    if(beforeBirthday)age--;
    return age>=0&&age<120?age:null;
  }

  function reportPlayerRows(records){
    return records.flatMap(r=>reportKnownPlayers(r).map(entry=>{
      const assessment=playerAssessment(entry.verification);
      return {
        ...entry,
        name:fullName(entry.player),
        gender:entry.player?.gender||"Not provided",
        club:entry.verification?.clubAffiliation||"Not provided",
        hasDupr:entry.verification?.hasDupr||"Not provided",
        rating:entry.verification?.hasDupr==="Yes"&&Number.isFinite(Number(entry.verification?.duprRating))?Number(entry.verification.duprRating):null,
        levelKey:assessment.levelKey||null,
        level:assessment.levelKey?levelLabel(assessment.levelKey):assessment.label||"Pending",
        verificationState:assessment.manual?"Needs validation":"Validated",
        age:reportAge(entry.player?.birthDate),
        jersey:entry.verification?.jerseyName||"",
      };
    }));
  }

  function reportDatePass(record){
    if(reportDateWindow==="all")return true;
    const raw=record?.submittedAt;
    if(!raw)return false;
    const d=new Date(raw);
    if(Number.isNaN(d.getTime()))return false;
    const now=new Date();
    const cutoff=new Date(now);
    cutoff.setHours(0,0,0,0);
    cutoff.setDate(cutoff.getDate()-Number(reportDateWindow));
    return d>=cutoff;
  }

  function reportFilteredRecords(){
    return getRecords().filter(r=>!r.deleted).filter(r=>{
      const eligibility=recordEligibility(r);
      if(reportStatus!=="all"&&(r.status||"Submitted")!==reportStatus)return false;
      if(reportDivision!=="all"&&!(r.divisions||[]).includes(reportDivision))return false;
      if(reportLevel!=="all"&&eligibility.levelKey!==reportLevel)return false;
      if(reportCategory!=="all"&&eligibility.categoryKey!==reportCategory)return false;
      return reportDatePass(r);
    });
  }

  function reportExpectedFee(record){
    const known=reportKnownPlayers(record).length||1;
    const division=(record.divisions||[]).map(getDivision).find(Boolean);
    const fee=Number(division?.fee??config.divisions?.find(d=>d.enabled)?.fee??1800)||0;
    return known*fee;
  }

  function reportKpis(records){
    const players=reportPlayerRows(records);
    const confirmed=records.filter(r=>r.status==="Confirmed").length;
    const needsReview=records.filter(r=>{
      const e=recordEligibility(r);
      return e.manualReview||e.classificationPending||e.partnerPending||e.categoryPending||e.levelMismatch;
    }).length;
    const duprPlayers=players.filter(p=>p.hasDupr==="Yes").length;
    const expected=records.reduce((sum,r)=>sum+reportExpectedFee(r),0);
    const paid=records.reduce((sum,r)=>sum+(Number(r.payment?.amountPaid)||0),0);
    const totalCapacity=(config.divisions||[]).filter(d=>d.enabled).reduce((sum,d)=>sum+(Number(d.capacity)||0),0);
    const assigned=records.filter(r=>(r.divisions||[]).length).length;
    return {
      registrations:records.length,
      players:players.length,
      confirmed,
      needsReview,
      duprCoverage:players.length?Math.round(duprPlayers/players.length*100):0,
      expected,
      paid,
      balance:Math.max(expected-paid,0),
      capacity:totalCapacity,
      assigned
    };
  }

  function reportGroup(items,keyFn,valueFn=()=>1){
    const map=new Map();
    items.forEach(item=>{
      const key=String(keyFn(item)||"Not specified");
      map.set(key,(map.get(key)||0)+Number(valueFn(item)||0));
    });
    return [...map.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
  }

  function reportTrend(records){
    const map=new Map();
    records.forEach(r=>{
      if(!r.submittedAt)return;
      const d=new Date(r.submittedAt);
      if(Number.isNaN(d.getTime()))return;
      const key=d.toISOString().slice(0,10);
      map.set(key,(map.get(key)||0)+1);
    });
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,value])=>({
      label:new Date(`${key}T00:00:00`).toLocaleDateString("en-PH",{month:"short",day:"numeric"}),
      rawLabel:key,
      value
    }));
  }

  function reportRatingBand(row){
    if(row.rating==null)return "No rating";
    const t=duprThresholds();
    if(row.rating<t.lowIntermediateMin)return `< ${t.lowIntermediateMin.toFixed(2)}`;
    if(row.rating<t.highIntermediateMin)return `${t.lowIntermediateMin.toFixed(2)}–${(t.highIntermediateMin-.01).toFixed(2)}`;
    if(row.rating<t.advancedMin)return `${t.highIntermediateMin.toFixed(2)}–${(t.advancedMin-.01).toFixed(2)}`;
    return `${t.advancedMin.toFixed(2)}+`;
  }

  function reportAgeBand(age){
    if(age==null)return "Not provided";
    if(age<18)return "Under 18";
    if(age<=24)return "18–24";
    if(age<=34)return "25–34";
    if(age<=44)return "35–44";
    if(age<=54)return "45–54";
    return "55+";
  }

  function reportVerificationBucket(record){
    const e=recordEligibility(record);
    if(e.levelMismatch)return "Level mismatch";
    if(e.partnerPending)return "Partner pending";
    if(e.classificationPending)return "Classification pending";
    if(e.categoryPending)return "Category pending";
    if(e.manualReview)return "Needs organizer validation";
    return "Ready";
  }

  function reportDefinitions(){
    return [
      ["status","Registrations by status","Registration"],
      ["division","Registrations by division","Registration"],
      ["level","Registrations by level","Registration"],
      ["category","Registrations by doubles category","Registration"],
      ["trend","Registration trend over time","Registration"],
      ["capacity","Division capacity utilization","Operations"],
      ["verification","Organizer validation workload","Fairness & verification"],
      ["actionRequired","Entries needing attention","Fairness & verification"],
      ["dupr","Players with / without DUPR","Fairness & verification"],
      ["ratingBands","DUPR rating distribution","Fairness & verification"],
      ["club","Players by club","Players"],
      ["gender","Players by gender","Players"],
      ["ageGroups","Players by age group","Players"],
      ["ageVsDupr","Age vs DUPR rating","Players"],
      ["paymentMethod","Payments by method","Payments"],
      ["paymentDivision","Recorded payments by division","Payments"],
      ["financial","Expected vs recorded fees","Payments"],
      ["jersey","Jersey print list","Operations"],
      ["detail","Full registration detail","Operations"]
    ].filter(([, ,group])=>group!=="Payments"||can("reports.financial"));
  }

  function reportDefinition(key,records){
    const players=reportPlayerRows(records);
    const eligibilityName=r=>{
      const e=recordEligibility(r);
      return e.levelKey?levelLabel(e.levelKey):e.label||"Pending";
    };
    const divisionName=r=>(r.divisions||[]).map(id=>getDivision(id)?.name||id).filter(Boolean).join(" | ")||"Pending";
    const categoryName=r=>recordEligibility(r).categoryLabel||"Pending";

    if(key==="status"){
      const rows=reportGroup(records,r=>r.status||"Submitted");
      return reportSimple("Registrations by status","Where registration requests currently sit in the approval process.",rows,"bar","Registrations");
    }
    if(key==="division"){
      const rows=reportGroup(records,divisionName);
      return reportSimple("Registrations by division","Demand across the automatically assigned tournament divisions.",rows,"hbar","Registrations");
    }
    if(key==="level"){
      const rows=reportGroup(records,eligibilityName);
      return reportSimple("Registrations by level","Pair entries grouped by their current tournament level.",rows,"bar","Registrations");
    }
    if(key==="category"){
      const rows=reportGroup(records,categoryName);
      return reportSimple("Registrations by doubles category","Men's, Women's, and Mixed entries based on registered player genders.",rows,"pie","Registrations");
    }
    if(key==="trend"){
      const rows=reportTrend(records);
      return reportSimple("Registration trend over time","Registration requests received by submission date.",rows,"line","Registrations");
    }
    if(key==="verification"){
      const rows=reportGroup(records,reportVerificationBucket);
      return reportSimple("Organizer validation workload","Shows how many entries are ready versus still needing organizer attention.",rows,"pie","Registrations");
    }
    if(key==="actionRequired"){
      const rows=records.filter(r=>reportVerificationBucket(r)!=="Ready").map(r=>{
        const e=recordEligibility(r);
        const players=[fullName(r.player1),r.registrationType==="pair"?fullName(r.player2):""].filter(Boolean).join(" / ");
        const division=(r.divisions||[]).map(id=>getDivision(id)?.name||id).filter(Boolean).join(" | ")||"Pending";
        return [
          r.reference||"—",
          players||"—",
          reportVerificationBucket(r),
          e.levelKey?levelLabel(e.levelKey):e.label||"Pending",
          e.categoryLabel||"Pending",
          division,
          r.status||"Submitted"
        ];
      });
      return {
        title:"Entries needing attention",
        description:"Registration requests that still need organizer action because of validation, partner, category, or level issues.",
        defaultChart:"table",
        tableOnly:true,
        tableHeaders:["Reference","Players","Issue","Level","Category","Division","Status"],
        tableRows:rows
      };
    }
    if(key==="dupr"){
      const rows=reportGroup(players,p=>p.hasDupr==="Yes"?"Has DUPR":p.hasDupr==="No"?"No DUPR":"Not provided");
      return reportSimple("Players with / without DUPR","DUPR availability across known registered players.",rows,"doughnut","Players");
    }
    if(key==="ratingBands"){
      const rows=reportGroup(players,reportRatingBand);
      return reportSimple("DUPR rating distribution","Known DUPR ratings grouped using the tournament's configured level thresholds.",rows,"bar","Players");
    }
    if(key==="club"){
      const rows=reportGroup(players,p=>p.club).slice(0,20);
      return reportSimple("Players by club","Top clubs represented in the current registration data.",rows,"hbar","Players");
    }
    if(key==="gender"){
      const rows=reportGroup(players,p=>p.gender);
      return reportSimple("Players by gender","Gender distribution of known registered players.",rows,"pie","Players");
    }
    if(key==="ageGroups"){
      const order=["Under 18","18–24","25–34","35–44","45–54","55+","Not provided"];
      const grouped=reportGroup(players,p=>reportAgeBand(p.age));
      const map=new Map(grouped.map(x=>[x.label,x.value]));
      const rows=order.filter(k=>map.has(k)).map(k=>({label:k,value:map.get(k)}));
      return reportSimple("Players by age group",`Age is calculated as of ${new Date(`${config.eventDate}T00:00:00`).toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}.`,rows,"bar","Players");
    }
    if(key==="ageVsDupr"){
      const points=players.filter(p=>p.age!=null&&p.rating!=null).map(p=>({
        x:p.age,y:p.rating,label:p.name,club:p.club,level:p.level
      }));
      return {
        title:"Age vs DUPR rating",
        description:"Relationship between player age and declared DUPR rating for players with both values available.",
        defaultChart:"scatter",
        scatter:true,
        points,
        valueLabel:"DUPR rating",
        tableHeaders:["Player","Age","DUPR rating","Level","Club"],
        tableRows:points.map(p=>[p.label,p.x,p.y.toFixed(2),p.level,p.club])
      };
    }
    if(key==="paymentMethod"){
      const rows=reportGroup(records,r=>r.payment?.method?paymentLabel(r.payment.method):"Not recorded");
      return reportSimple("Payments by method","Registration records grouped by the payment method entered by the registrant.",rows,"pie","Registrations");
    }
    if(key==="paymentDivision"){
      const rows=reportGroup(records,divisionName,r=>Number(r.payment?.amountPaid)||0);
      return reportSimple("Recorded payments by division","Total payment amounts recorded against each assigned division.",rows,"hbar","Amount","currency");
    }
    if(key==="financial"){
      const expected=records.reduce((s,r)=>s+reportExpectedFee(r),0);
      const paid=records.reduce((s,r)=>s+(Number(r.payment?.amountPaid)||0),0);
      const rows=[
        {label:"Expected fees",value:expected},
        {label:"Recorded payments",value:paid},
        {label:"Balance not yet recorded",value:Math.max(expected-paid,0)}
      ];
      return reportSimple("Expected vs recorded fees","Expected fees are calculated from known players and the fee configured for their assigned division.",rows,"bar","Amount","currency");
    }
    if(key==="capacity"){
      const enabled=(config.divisions||[]).filter(d=>d.enabled);
      const tableRows=enabled.map(d=>{
        const registered=records.filter(r=>(r.divisions||[]).includes(d.id)).length;
        const capacity=Number(d.capacity)||0;
        const remaining=capacity?Math.max(capacity-registered,0):null;
        const utilization=capacity?Math.round(registered/capacity*100):null;
        return [d.name,registered,capacity||"—",remaining??"—",utilization==null?"—":`${utilization}%`];
      });
      const rows=enabled.map(d=>{
        const registered=records.filter(r=>(r.divisions||[]).includes(d.id)).length;
        const capacity=Number(d.capacity)||0;
        return {label:d.name,value:capacity?Math.round(registered/capacity*100):0};
      });
      return {
        ...reportSimple("Division capacity utilization","Assigned registrations compared with the configured team-slot capacity for each enabled division.",rows,"hbar","Utilization","percent"),
        tableHeaders:["Division","Assigned teams","Capacity","Remaining","Utilization"],
        tableRows
      };
    }
    if(key==="jersey"){
      const rows=players.map(p=>[
        p.jersey||"—",p.name,p.record.reference||"—",
        (p.record.divisions||[]).map(id=>getDivision(id)?.name||id).join(" | ")||"Pending",
        p.club
      ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
      return {
        title:"Jersey print list",
        description:"Names submitted for jersey-back printing, with the player and registration reference for checking.",
        defaultChart:"table",
        tableOnly:true,
        tableHeaders:["Jersey name","Player","Registration","Division","Club"],
        tableRows:rows
      };
    }
    if(key==="detail"){
      const rows=records.map(r=>{
        const e=recordEligibility(r), v1=r.verification1||{}, v2=r.verification2||{};
        return [
          r.reference||"—",r.status||"Submitted",
          fullName(r.player1),r.registrationType==="pair"?fullName(r.player2):"—",
          (r.divisions||[]).map(id=>getDivision(id)?.name||id).join(" | ")||"Pending",
          e.levelKey?levelLabel(e.levelKey):e.label||"Pending",
          e.categoryLabel||"Pending",
          e.manualReview?"Needs validation":"Ready",
          v1.clubAffiliation||"—",v2.clubAffiliation||"—",
          r.payment?.method?paymentLabel(r.payment.method):"—",
          Number(r.payment?.amountPaid)||0,
          r.submittedAt?new Date(r.submittedAt).toLocaleString("en-PH"):"—"
        ];
      });
      return {
        title:"Full registration detail",
        description:"A complete organizer-facing registration table for reconciliation and review.",
        defaultChart:"table",
        tableOnly:true,
        tableHeaders:["Reference","Status","Player 1","Player 2","Division","Level","Category","Verification","Player 1 Club","Player 2 Club","Payment Method","Amount Paid","Submitted"],
        tableRows:rows
      };
    }
    return reportSimple("Registration report","Registration data summary.",[],"bar","Registrations");
  }

  function reportSimple(title,description,rows,defaultChart,valueLabel,valueFormat="number"){
    return {
      title,description,rows,defaultChart,valueLabel,valueFormat,
      tableHeaders:["Category",valueLabel],
      tableRows:rows.map(r=>[r.label,reportFormatValue(r.value,valueFormat)])
    };
  }

  function reportFormatValue(value,format="number"){
    if(format==="currency")return formatMoney(value);
    if(format==="percent")return `${Number(value||0).toLocaleString("en-PH")}%`;
    return Number(value||0).toLocaleString("en-PH");
  }

  function reportChartOptions(def){
    if(def.tableOnly)return [["table","Table"]];
    if(def.scatter)return [["scatter","Scatter"],["table","Table"]];
    return [
      ["auto","Best fit"],
      ["bar","Bar"],
      ["hbar","Horizontal bar"],
      ["line","Line"],
      ["area","Area"],
      ["pie","Pie"],
      ["doughnut","Doughnut"],
      ["table","Table"]
    ];
  }

  function reportSelectOptions(){
    const groups={};
    reportDefinitions().forEach(([key,label,group])=>{(groups[group]??=[]).push([key,label])});
    return Object.entries(groups).map(([group,items])=>
      `<optgroup label="${esc(group)}">${items.map(([key,label])=>`<option value="${esc(key)}" ${key===reportKey?"selected":""}>${esc(label)}</option>`).join("")}</optgroup>`
    ).join("");
  }

  function reportFilterControls(){
    const statuses=["Submitted","Payment Submitted","Awaiting Partner","Pending Level Validation","Pending","Approved","Confirmed","Rejected","Cancelled"];
    const levels=["beginner","lowIntermediate","highIntermediate","advanced"];
    return `<div class="bi-filter-row">
      <label class="field bi-field"><span>Date</span><select id="reportDateWindow">
        <option value="all" ${reportDateWindow==="all"?"selected":""}>All registration dates</option>
        <option value="7" ${reportDateWindow==="7"?"selected":""}>Last 7 days</option>
        <option value="30" ${reportDateWindow==="30"?"selected":""}>Last 30 days</option>
        <option value="90" ${reportDateWindow==="90"?"selected":""}>Last 90 days</option>
      </select></label>
      <label class="field bi-field"><span>Status</span><select id="reportStatus">
        <option value="all">All statuses</option>${statuses.map(s=>`<option value="${esc(s)}" ${s===reportStatus?"selected":""}>${esc(s)}</option>`).join("")}
      </select></label>
      <label class="field bi-field"><span>Division</span><select id="reportDivision">
        <option value="all">All divisions</option>${(config.divisions||[]).filter(d=>d.enabled).map(d=>`<option value="${esc(d.id)}" ${d.id===reportDivision?"selected":""}>${esc(d.name)}</option>`).join("")}
      </select></label>
      <label class="field bi-field"><span>Level</span><select id="reportLevel">
        <option value="all">All levels</option>${levels.map(k=>`<option value="${k}" ${k===reportLevel?"selected":""}>${esc(levelLabel(k))}</option>`).join("")}
      </select></label>
      <label class="field bi-field"><span>Category</span><select id="reportCategory">
        <option value="all">All categories</option>
        <option value="men" ${reportCategory==="men"?"selected":""}>Men's Doubles</option>
        <option value="women" ${reportCategory==="women"?"selected":""}>Women's Doubles</option>
        <option value="mixed" ${reportCategory==="mixed"?"selected":""}>Mixed Doubles</option>
      </select></label>
      <button class="button button-ghost bi-reset-filter" id="resetReportFilters" type="button">Reset Filters</button>
    </div>`;
  }

  function reportKpiCard(label,value,help){
    return `<article class="bi-kpi"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(help)}</small></article>`;
  }

  function reportInsights(records,kpis){
    const players=reportPlayerRows(records);
    const topDivision=reportGroup(records,r=>(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(" | ")||"Pending")[0];
    const noDupr=players.filter(p=>p.hasDupr==="No").length;
    const pendingProof=players.filter(p=>p.hasDupr==="Yes"&&p.verification?.duprProofStatus!=="Verified").length;
    const confirmedPct=kpis.registrations?Math.round(kpis.confirmed/kpis.registrations*100):0;
    return `<div class="bi-insight-grid">
      <article><span>Most requested division</span><strong>${esc(topDivision?.label||"No data yet")}</strong><small>${topDivision?`${topDivision.value} registration${topDivision.value===1?"":"s"}`:"Registrations will populate this insight."}</small></article>
      <article><span>Fairness review</span><strong>${kpis.needsReview.toLocaleString("en-PH")} need attention</strong><small>${noDupr.toLocaleString("en-PH")} no-DUPR player${noDupr===1?"":"s"} · ${pendingProof.toLocaleString("en-PH")} DUPR proof${pendingProof===1?"":"s"} pending</small></article>
      <article><span>Confirmation progress</span><strong>${confirmedPct}% confirmed</strong><small>${kpis.confirmed.toLocaleString("en-PH")} of ${kpis.registrations.toLocaleString("en-PH")} filtered registrations</small></article>
    </div>`;
  }

  function reportAxisMax(values){
    const max=Math.max(...values,0);
    if(max<=0)return 1;
    const magnitude=Math.pow(10,Math.floor(Math.log10(max)));
    return Math.ceil(max/magnitude*1.15)*magnitude;
  }

  function reportBarChart(rows,format="number",horizontal=false){
    if(!rows.length)return reportEmptyChart();
    const data=rows.slice(0,20);
    if(horizontal){
      const w=960, left=210, right=55, top=24, rowH=36, h=Math.max(280,top+data.length*rowH+34);
      const max=reportAxisMax(data.map(r=>r.value));
      const plot=w-left-right;
      const bars=data.map((r,i)=>{
        const y=top+i*rowH;
        const width=Math.max(2,(Number(r.value)||0)/max*plot);
        const color=reportPalette[i%reportPalette.length];
        return `<text x="${left-12}" y="${y+17}" text-anchor="end" class="bi-svg-label">${esc(r.label)}</text>
          <rect x="${left}" y="${y}" width="${width}" height="22" rx="7" fill="${color}"></rect>
          <text x="${Math.min(left+width+8,w-8)}" y="${y+16}" class="bi-svg-value">${esc(reportFormatValue(r.value,format))}</text>`;
      }).join("");
      return `<svg class="bi-svg-chart bi-svg-hbar" viewBox="0 0 ${w} ${h}" role="img" aria-label="Horizontal bar chart">${bars}</svg>`;
    }
    const w=960,h=390,left=56,right=22,top=26,bottom=88;
    const max=reportAxisMax(data.map(r=>r.value)),plotW=w-left-right,plotH=h-top-bottom;
    const slot=plotW/data.length,barW=Math.min(58,slot*.62);
    const bars=data.map((r,i)=>{
      const v=Number(r.value)||0;
      const bh=v/max*plotH;
      const x=left+i*slot+(slot-barW)/2, y=top+plotH-bh;
      const color=reportPalette[i%reportPalette.length];
      const label=String(r.label).length>17?String(r.label).slice(0,16)+"…":r.label;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(bh,2)}" rx="7" fill="${color}"></rect>
        <text x="${x+barW/2}" y="${Math.max(y-8,14)}" text-anchor="middle" class="bi-svg-value">${esc(reportFormatValue(v,format))}</text>
        <text x="${x+barW/2}" y="${top+plotH+22}" text-anchor="end" transform="rotate(-38 ${x+barW/2} ${top+plotH+22})" class="bi-svg-label">${esc(label)}</text>`;
    }).join("");
    const grid=[0,.25,.5,.75,1].map(p=>{
      const y=top+plotH-(p*plotH);
      return `<line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}" class="bi-svg-grid"></line>
        <text x="${left-9}" y="${y+4}" text-anchor="end" class="bi-svg-tick">${esc(reportFormatValue(max*p,format))}</text>`;
    }).join("");
    return `<svg class="bi-svg-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Bar chart">${grid}${bars}</svg>`;
  }

  function reportLineChart(rows,format="number",area=false){
    if(!rows.length)return reportEmptyChart();
    const data=rows.slice(-30);
    const w=960,h=370,left=66,right=28,top=28,bottom=58;
    const plotW=w-left-right,plotH=h-top-bottom,max=reportAxisMax(data.map(r=>r.value));
    const step=data.length>1?plotW/(data.length-1):plotW;
    const points=data.map((r,i)=>({
      x:left+(data.length===1?plotW/2:i*step),
      y:top+plotH-(Number(r.value)||0)/max*plotH,
      row:r
    }));
    const path=points.map((p,i)=>`${i?"L":"M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaPath=area?`${path} L ${points.at(-1).x} ${top+plotH} L ${points[0].x} ${top+plotH} Z`:"";
    const grid=[0,.25,.5,.75,1].map(p=>{
      const y=top+plotH-p*plotH;
      return `<line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}" class="bi-svg-grid"></line>
        <text x="${left-10}" y="${y+4}" text-anchor="end" class="bi-svg-tick">${esc(reportFormatValue(max*p,format))}</text>`;
    }).join("");
    const labels=points.map((p,i)=>{
      const show=data.length<=10||i===0||i===data.length-1||i%Math.ceil(data.length/8)===0;
      return show?`<text x="${p.x}" y="${top+plotH+24}" text-anchor="middle" class="bi-svg-label">${esc(p.row.label)}</text>`:"";
    }).join("");
    const dots=points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#0b4a34"><title>${esc(p.row.label)}: ${esc(reportFormatValue(p.row.value,format))}</title></circle>`).join("");
    return `<svg class="bi-svg-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${area?"Area":"Line"} chart">
      ${grid}${area?`<path d="${areaPath}" fill="rgba(24,124,88,.16)"></path>`:""}
      <path d="${path}" fill="none" stroke="#0b4a34" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}${labels}
    </svg>`;
  }

  function reportPieChart(rows,format="number",doughnut=false){
    if(!rows.length||rows.reduce((s,r)=>s+Math.max(0,Number(r.value)||0),0)<=0)return reportEmptyChart();
    const data=rows.slice(0,10);
    const total=data.reduce((s,r)=>s+Math.max(0,Number(r.value)||0),0);
    let running=0;
    const stops=data.map((r,i)=>{
      const start=running;
      running+=Math.max(0,Number(r.value)||0)/total*100;
      return `${reportPalette[i%reportPalette.length]} ${start.toFixed(2)}% ${running.toFixed(2)}%`;
    }).join(",");
    return `<div class="bi-pie-layout">
      <div class="bi-pie ${doughnut?"bi-doughnut":""}" style="background:conic-gradient(${stops})">
        ${doughnut?`<div class="bi-pie-center"><strong>${esc(reportFormatValue(total,format))}</strong><span>Total</span></div>`:""}
      </div>
      <div class="bi-legend">${data.map((r,i)=>{
        const pct=total?Math.round(Number(r.value||0)/total*100):0;
        return `<div><i style="background:${reportPalette[i%reportPalette.length]}"></i><span>${esc(r.label)}</span><strong>${esc(reportFormatValue(r.value,format))}</strong><small>${pct}%</small></div>`;
      }).join("")}</div>
    </div>`;
  }

  function reportScatterChart(points){
    if(!points.length)return reportEmptyChart("No players currently have both a valid date of birth and DUPR rating in the filtered data.");
    const w=960,h=390,left=70,right=30,top=28,bottom=62;
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    if(minX===maxX){minX-=1;maxX+=1}
    if(minY===maxY){minY-=.25;maxY+=.25}
    minY=Math.floor(minY*2)/2; maxY=Math.ceil(maxY*2)/2;
    const plotW=w-left-right,plotH=h-top-bottom;
    const xPos=x=>left+(x-minX)/(maxX-minX)*plotW;
    const yPos=y=>top+plotH-(y-minY)/(maxY-minY)*plotH;
    const grid=[0,.25,.5,.75,1].map(p=>{
      const y=top+plotH-p*plotH, val=minY+p*(maxY-minY);
      return `<line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}" class="bi-svg-grid"></line><text x="${left-10}" y="${y+4}" text-anchor="end" class="bi-svg-tick">${val.toFixed(2)}</text>`;
    }).join("");
    const dots=points.map((p,i)=>{
      const c=reportPalette[i%reportPalette.length];
      return `<circle cx="${xPos(p.x)}" cy="${yPos(p.y)}" r="6" fill="${c}" opacity=".86"><title>${esc(p.label)} · Age ${p.x} · DUPR ${p.y.toFixed(2)} · ${esc(p.club)}</title></circle>`;
    }).join("");
    const xLabels=[0,.25,.5,.75,1].map(p=>{
      const x=left+p*plotW,val=Math.round(minX+p*(maxX-minX));
      return `<text x="${x}" y="${top+plotH+27}" text-anchor="middle" class="bi-svg-label">${val}</text>`;
    }).join("");
    return `<svg class="bi-svg-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Scatter chart">${grid}${xLabels}${dots}<text x="${left+plotW/2}" y="${h-10}" text-anchor="middle" class="bi-svg-axis-title">Age on tournament date</text><text transform="translate(18 ${top+plotH/2}) rotate(-90)" text-anchor="middle" class="bi-svg-axis-title">DUPR rating</text></svg>`;
  }

  function reportEmptyChart(message="No data is available for this report with the current filters."){
    return `<div class="bi-chart-empty"><div class="bi-empty-icon">↗</div><strong>No chart data yet</strong><p>${esc(message)}</p></div>`;
  }

  function reportChartMarkupForType(def,requestedType="auto"){
    let type=requestedType==="auto"?def.defaultChart:requestedType;
    if(def.tableOnly)type="table";
    if(def.scatter&&!["scatter","table"].includes(type))type="scatter";
    if(type==="table")return `<div class="bi-table-only-message"><strong>Table view selected</strong><span>The detailed report is shown below.</span></div>`;
    if(type==="scatter")return reportScatterChart(def.points||[]);
    const rows=def.rows||[];
    if(type==="bar")return reportBarChart(rows,def.valueFormat,false);
    if(type==="hbar")return reportBarChart(rows,def.valueFormat,true);
    if(type==="line")return reportLineChart(rows,def.valueFormat,false);
    if(type==="area")return reportLineChart(rows,def.valueFormat,true);
    if(type==="pie")return reportPieChart(rows,def.valueFormat,false);
    if(type==="doughnut")return reportPieChart(rows,def.valueFormat,true);
    return reportBarChart(rows,def.valueFormat,false);
  }

  function reportChartMarkup(def){
    return reportChartMarkupForType(def,reportChartType);
  }

  function reportTableMarkup(def){
    const headers=def.tableHeaders||[];
    const rows=def.tableRows||[];
    return `<div class="bi-table-shell">
      <div class="bi-table-title">
        <div><span class="eyebrow">Report table</span><h3>Detailed data</h3><p>${rows.length.toLocaleString("en-PH")} row${rows.length===1?"":"s"} in the current report.</p></div>
        <button class="button button-ghost" id="downloadCurrentReport" type="button" ${rows.length?"":"disabled"}>Download Table</button>
      </div>
      <div class="bi-table-scroll">
        <table class="bi-table">
          <thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.length?rows.map(row=>`<tr>${row.map((cell,i)=>`<td class="${i===0?"bi-table-primary":""}">${esc(cell??"—")}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${Math.max(headers.length,1)}"><div class="bi-inline-empty">No rows match the current filters.</div></td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
  }


  // =========================================================
  // CUSTOMIZABLE ORGANIZER DASHBOARD
  // =========================================================
  function defaultDashboardWidgets(){
    return [
      {id:"dash-trend",reportKey:"trend",chartType:"line",width:8,height:"standard",title:"Registration Trend"},
      {id:"dash-status",reportKey:"status",chartType:"doughnut",width:4,height:"standard",title:"Registration Status"},
      {id:"dash-division",reportKey:"division",chartType:"hbar",width:8,height:"standard",title:"Division Demand"},
      {id:"dash-attention",reportKey:"verification",chartType:"doughnut",width:4,height:"standard",title:"Validation Workload"},
      {id:"dash-capacity",reportKey:"capacity",chartType:"hbar",width:8,height:"standard",title:"Division Capacity"},
      {id:"dash-dupr",reportKey:"dupr",chartType:"doughnut",width:4,height:"standard",title:"DUPR Coverage"},
      {id:"dash-financial",reportKey:"financial",chartType:"bar",width:6,height:"standard",title:"Registration Fees"},
      {id:"dash-clubs",reportKey:"club",chartType:"hbar",width:6,height:"standard",title:"Club Representation"},
      {id:"dash-action-table",reportKey:"actionRequired",chartType:"table",width:12,height:"tall",title:"Entries Needing Attention"}
    ];
  }

  function normalizeDashboardWidget(widget,index=0){
    const keys=new Set(reportDefinitions().map(x=>x[0]));
    const width=[4,6,8,12].includes(Number(widget?.width))?Number(widget.width):6;
    const height=["compact","standard","tall"].includes(widget?.height)?widget.height:"standard";
    return {
      id:String(widget?.id||`dash-${Date.now()}-${index}`),
      reportKey:keys.has(widget?.reportKey)?widget.reportKey:"status",
      chartType:String(widget?.chartType||"auto"),
      width,
      height,
      title:String(widget?.title||"").trim()
    };
  }

  function loadDashboardWidgets(){
    try{
      const parsed=JSON.parse(localStorage.getItem(REPORT_DASHBOARD_KEY)||"null");
      if(Array.isArray(parsed)&&parsed.length)return parsed.map(normalizeDashboardWidget);
    }catch(e){console.warn(e)}
    return defaultDashboardWidgets().filter(w=>w.reportKey!=="financial"||can("reports.financial"));
  }

  function saveDashboardWidgets(widgets){
    try{localStorage.setItem(REPORT_DASHBOARD_KEY,JSON.stringify(widgets.map(normalizeDashboardWidget)));return true}
    catch(e){console.warn(e);showToast("Dashboard layout could not be saved");return false}
  }

  function dashboardWidgets(){
    return loadDashboardWidgets().filter(w=>w.reportKey!=="financial"||can("reports.financial"));
  }

  function dashboardUpdate(mutator){
    const widgets=dashboardWidgets();
    mutator(widgets);
    saveDashboardWidgets(widgets);
    renderAdmin();
  }

  function dashboardReportLabel(key){
    return reportDefinitions().find(([k])=>k===key)?.[1]||key;
  }

  function dashboardChartLabel(type){
    return ({auto:"Best fit",bar:"Bar",hbar:"Horizontal bar",line:"Line",area:"Area",pie:"Pie",doughnut:"Doughnut",scatter:"Scatter",table:"Table"})[type]||type;
  }

  function dashboardSizeLabel(width){
    return ({4:"Small",6:"Medium",8:"Large",12:"Full width"})[width]||"Medium";
  }

  function dashboardHeightLabel(height){
    return ({compact:"Compact",standard:"Standard",tall:"Tall"})[height]||"Standard";
  }

  function dashboardCompactTable(def,limit=8){
    const headers=def.tableHeaders||[];
    const rows=(def.tableRows||[]).slice(0,limit);
    return `<div class="dashboard-table-scroll">
      <table class="dashboard-mini-table">
        <thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.length?rows.map(row=>`<tr>${row.map((cell,i)=>`<td class="${i===0?"dashboard-table-primary":""}">${esc(cell??"—")}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${Math.max(headers.length,1)}"><div class="bi-inline-empty">No rows match the current filters.</div></td></tr>`}</tbody>
      </table>
      ${(def.tableRows||[]).length>limit?`<div class="dashboard-table-more">Showing ${limit} of ${(def.tableRows||[]).length.toLocaleString("en-PH")} rows. Open Report Explorer for the complete table.</div>`:""}
    </div>`;
  }

  function dashboardWidgetVisual(widget,records){
    const def=reportDefinition(widget.reportKey,records);
    let type=widget.chartType||"auto";
    const options=reportChartOptions(def).map(x=>x[0]);
    if(!options.includes(type))type=options[0]||"table";
    if(type==="auto")type=def.defaultChart;
    if(def.tableOnly||type==="table")return dashboardCompactTable(def,widget.height==="tall"?12:widget.height==="compact"?5:8);
    return reportChartMarkupForType(def,type);
  }

  function dashboardWidgetMarkup(widget,records){
    const def=reportDefinition(widget.reportKey,records);
    const title=widget.title||def.title;
    const actualType=widget.chartType==="auto"?def.defaultChart:widget.chartType;
    return `<article class="dashboard-widget dashboard-w-${widget.width} dashboard-h-${widget.height} ${dashboardEditMode?"is-editing":""}" data-dashboard-widget="${esc(widget.id)}" draggable="${dashboardEditMode?"true":"false"}">
      <div class="dashboard-widget-head">
        <div class="dashboard-widget-title">
          ${dashboardEditMode?`<button class="dashboard-drag-handle" type="button" title="Drag to move" aria-label="Drag to move">⋮⋮</button>`:""}
          <div>
            <span class="dashboard-widget-kicker">${esc(dashboardReportLabel(widget.reportKey))}</span>
            <h3>${esc(title)}</h3>
          </div>
        </div>
        ${dashboardEditMode?`<div class="dashboard-widget-actions">
          <button type="button" data-dashboard-resize="${esc(widget.id)}" title="Resize panel">Resize</button>
          <button type="button" data-dashboard-configure="${esc(widget.id)}" title="Configure panel">Configure</button>
          <button class="danger" type="button" data-dashboard-remove="${esc(widget.id)}" title="Remove panel">Remove</button>
        </div>`:`<span class="dashboard-visual-badge">${esc(dashboardChartLabel(actualType))}</span>`}
      </div>
      <div class="dashboard-widget-body">${dashboardWidgetVisual(widget,records)}</div>
      ${dashboardEditMode?`<div class="dashboard-widget-meta"><span>${esc(dashboardSizeLabel(widget.width))}</span><span>${esc(dashboardHeightLabel(widget.height))}</span><span>Drag to reorder</span></div>`:""}
    </article>`;
  }

  function dashboardConfigDialog(){
    const widgets=dashboardWidgets();
    const current=widgets.find(w=>w.id===dashboardConfigTarget)||null;
    const isEdit=!!current;
    const selectedKey=current?.reportKey||"status";
    const def=reportDefinition(selectedKey,reportFilteredRecords());
    const chartOptions=reportChartOptions(def);
    const currentChart=chartOptions.some(([v])=>v===current?.chartType)?current.chartType:(chartOptions[0]?.[0]||"table");
    return `<dialog class="dashboard-dialog" id="dashboardConfigDialog">
      <form method="dialog" class="dashboard-dialog-card" id="dashboardConfigForm">
        <div class="dashboard-dialog-head">
          <div><span class="eyebrow">${isEdit?"Configure panel":"Add panel"}</span><h3>${isEdit?"Customize this dashboard panel":"Add a report to your dashboard"}</h3><p>Choose the report, visual, and space it should use.</p></div>
          <button class="dashboard-dialog-close" value="cancel" type="submit" aria-label="Close">×</button>
        </div>
        <div class="dashboard-dialog-grid">
          <label class="field"><span>Panel title</span><input id="dashboardWidgetTitle" value="${esc(current?.title||"")}" placeholder="Use report title" /></label>
          <label class="field"><span>Report</span><select id="dashboardWidgetReport">${reportDefinitions().map(([key,label,group])=>`<option value="${esc(key)}" ${key===selectedKey?"selected":""}>${esc(group)} — ${esc(label)}</option>`).join("")}</select></label>
          <label class="field"><span>Visual</span><select id="dashboardWidgetChart">${chartOptions.map(([value,label])=>`<option value="${value}" ${value===currentChart?"selected":""}>${esc(label)}</option>`).join("")}</select></label>
          <label class="field"><span>Width</span><select id="dashboardWidgetWidth">
            <option value="4" ${Number(current?.width||6)===4?"selected":""}>Small — 1/3 row</option>
            <option value="6" ${Number(current?.width||6)===6?"selected":""}>Medium — 1/2 row</option>
            <option value="8" ${Number(current?.width||6)===8?"selected":""}>Large — 2/3 row</option>
            <option value="12" ${Number(current?.width||6)===12?"selected":""}>Full width</option>
          </select></label>
          <label class="field"><span>Height</span><select id="dashboardWidgetHeight">
            <option value="compact" ${current?.height==="compact"?"selected":""}>Compact</option>
            <option value="standard" ${!current||current.height==="standard"?"selected":""}>Standard</option>
            <option value="tall" ${current?.height==="tall"?"selected":""}>Tall</option>
          </select></label>
        </div>
        <div class="dashboard-dialog-actions">
          <button class="button button-ghost" value="cancel" type="submit">Cancel</button>
          <button class="button button-primary" id="saveDashboardWidget" type="button">${isEdit?"Save Panel":"Add to Dashboard"}</button>
        </div>
      </form>
    </dialog>`;
  }

  function dashboardTemplateMarkup(records){
    const widgets=dashboardWidgets();
    return `<section class="dashboard-template-section">
      <div class="dashboard-section-head">
        <div>
          <span class="eyebrow">Organizer dashboard</span>
          <h3>Tournament Registration Overview</h3>
          <p>A ready-made dashboard focused on the information organizers are most likely to need for registration decisions and tournament readiness.</p>
        </div>
        <div class="dashboard-section-actions">
          <button class="button ${dashboardEditMode?"button-primary":"button-ghost"}" id="toggleDashboardEdit" type="button">${dashboardEditMode?"Finish Customizing":"Customize Dashboard"}</button>
          ${dashboardEditMode?`<button class="button button-ghost" id="addDashboardWidget" type="button">Add Panel</button><button class="button button-ghost" id="resetDashboardTemplate" type="button">Reset Template</button>`:""}
        </div>
      </div>
      ${dashboardEditMode?`<div class="dashboard-edit-notice"><strong>Customization mode</strong><span>Drag panels to reorder them. Use Resize, Configure, or Remove on any panel. Your layout saves automatically in this browser.</span></div>`:""}
      <div class="dashboard-grid ${dashboardEditMode?"dashboard-grid-editing":""}" id="dashboardGrid">
        ${widgets.map(widget=>dashboardWidgetMarkup(widget,records)).join("")}
        ${dashboardEditMode?`<button class="dashboard-add-tile" id="dashboardAddTile" type="button"><span>＋</span><strong>Add another panel</strong><small>Choose from registration, verification, player, payment, and operations reports.</small></button>`:""}
      </div>
      ${dashboardConfigDialog()}
    </section>`;
  }

  function dashboardCycleSize(id){
    dashboardUpdate(widgets=>{
      const widget=widgets.find(w=>w.id===id);
      if(!widget)return;
      const sizes=[4,6,8,12];
      const index=sizes.indexOf(Number(widget.width));
      widget.width=sizes[(index+1)%sizes.length];
    });
  }

  function dashboardRemoveWidget(id){
    const widgets=dashboardWidgets();
    const widget=widgets.find(w=>w.id===id);
    if(!widget)return;
    if(!confirm(`Remove "${widget.title||dashboardReportLabel(widget.reportKey)}" from this dashboard?`))return;
    saveDashboardWidgets(widgets.filter(w=>w.id!==id));
    renderAdmin();
  }

  function dashboardReset(){
    if(!confirm("Reset the dashboard to the recommended organizer template? Your current dashboard layout will be replaced."))return;
    saveDashboardWidgets(defaultDashboardWidgets());
    showToast("Dashboard template restored");
    renderAdmin();
  }

  function openDashboardConfig(id=null){
    dashboardConfigTarget=id;
    renderAdmin();
    const dialog=$("#dashboardConfigDialog");
    if(dialog&&typeof dialog.showModal==="function")dialog.showModal();
  }

  function dashboardSaveConfig(){
    const widgets=dashboardWidgets();
    const report=$("#dashboardWidgetReport")?.value||"status";
    const def=reportDefinition(report,reportFilteredRecords());
    const allowed=reportChartOptions(def).map(x=>x[0]);
    let chart=$("#dashboardWidgetChart")?.value||"auto";
    if(!allowed.includes(chart))chart=allowed[0]||"table";
    const payload={
      reportKey:report,
      chartType:chart,
      width:Number($("#dashboardWidgetWidth")?.value)||6,
      height:$("#dashboardWidgetHeight")?.value||"standard",
      title:String($("#dashboardWidgetTitle")?.value||"").trim()
    };
    if(dashboardConfigTarget){
      const target=widgets.find(w=>w.id===dashboardConfigTarget);
      if(target)Object.assign(target,payload);
    }else{
      widgets.push(normalizeDashboardWidget({id:`dash-${Date.now()}`, ...payload},widgets.length));
    }
    saveDashboardWidgets(widgets);
    dashboardConfigTarget=null;
    showToast("Dashboard updated");
    renderAdmin();
  }

  function dashboardReorder(sourceId,targetId){
    if(!sourceId||!targetId||sourceId===targetId)return;
    dashboardUpdate(widgets=>{
      const from=widgets.findIndex(w=>w.id===sourceId);
      const to=widgets.findIndex(w=>w.id===targetId);
      if(from<0||to<0)return;
      const [moved]=widgets.splice(from,1);
      widgets.splice(to,0,moved);
    });
  }

  function renderAdminReports(){
    const records=reportFilteredRecords();
    const k=reportKpis(records);
    const def=reportDefinition(reportKey,records);
    const chartOptions=reportChartOptions(def);
    if(!chartOptions.some(([value])=>value===reportChartType))reportChartType=chartOptions[0][0];

    return `<div class="bi-page">
      <div class="admin-panel-heading bi-heading">
        <div>
          <p class="eyebrow">Reports & insights</p>
          <h2>Registration Intelligence</h2>
          <p>Start with the recommended organizer dashboard, then customize it or explore any registration report in more detail.</p>
        </div>
        <div class="bi-heading-actions">
          <button class="button button-ghost" id="printReportButton" type="button">Print / Save PDF</button>
        </div>
      </div>

      <div class="bi-kpi-grid">
        ${reportKpiCard("Registration requests",k.registrations.toLocaleString("en-PH"),"Filtered active records")}
        ${reportKpiCard("Known players",k.players.toLocaleString("en-PH"),"Player profiles in the filtered data")}
        ${reportKpiCard("Confirmed entries",k.confirmed.toLocaleString("en-PH"),"Registrations marked Confirmed")}
        ${can("reports.financial")?reportKpiCard("Recorded payments",formatMoney(k.paid),"Amounts entered in registration records"):""}
        ${reportKpiCard("DUPR coverage",`${k.duprCoverage}%`,"Known players with a DUPR rating")}
        ${reportKpiCard("Needs attention",k.needsReview.toLocaleString("en-PH"),"Verification, partner, category, or level issues")}
      </div>

      ${reportInsights(records,k)}

      <section class="dashboard-filter-section">
        <div class="dashboard-filter-head">
          <div><span class="eyebrow">Dashboard filters</span><h3>Filter the whole reports page</h3><p>These filters apply to the dashboard and the Report Explorer below.</p></div>
        </div>
        ${reportFilterControls()}
      </section>

      ${dashboardTemplateMarkup(records)}

      <details class="bi-explorer-details">
        <summary>
          <div><span class="eyebrow">Report explorer</span><strong>Explore More Reports</strong><small>Open the full report library, switch visual types, and inspect detailed tables.</small></div>
          <span class="bi-explorer-chevron">⌄</span>
        </summary>

        <section class="bi-explorer">
          <div class="bi-explorer-top">
            <div>
              <span class="eyebrow">Build your view</span>
              <h3>Report Explorer</h3>
              <p>Select any report, change the visual, and inspect its complete table. Use this for deeper analysis beyond the organizer dashboard.</p>
            </div>
            <div class="bi-core-controls">
              <label class="field bi-report-select"><span>Report</span><select id="reportKey">${reportSelectOptions()}</select></label>
              <label class="field bi-chart-select"><span>Show as</span><select id="reportChartType">${chartOptions.map(([value,label])=>`<option value="${value}" ${value===reportChartType?"selected":""}>${esc(label)}</option>`).join("")}</select></label>
            </div>
          </div>

          <div class="bi-visual-card">
            <div class="bi-visual-head">
              <div><span class="eyebrow">Visualization</span><h3>${esc(def.title)}</h3><p>${esc(def.description)}</p></div>
              <span class="bi-filter-count">${records.length.toLocaleString("en-PH")} registration${records.length===1?"":"s"} in scope</span>
            </div>
            <div class="bi-chart-stage">${reportChartMarkup(def)}</div>
          </div>

          ${reportTableMarkup(def)}
        </section>
      </details>

      ${can("reports.financial")?`<section class="bi-finance-strip">
        <div><span>Expected fees</span><strong>${formatMoney(k.expected)}</strong><small>Based on known players and configured division fees</small></div>
        <div><span>Recorded payments</span><strong>${formatMoney(k.paid)}</strong><small>Amounts entered in registration records</small></div>
        <div><span>Balance not yet recorded</span><strong>${formatMoney(k.balance)}</strong><small>Expected fees minus recorded payment amounts</small></div>
        <div><span>Assigned capacity</span><strong>${k.capacity?`${k.assigned}/${k.capacity}`:`${k.assigned}`}</strong><small>${k.capacity?"Assigned team slots across configured divisions":"Assigned registrations"}</small></div>
      </section>`:""}
    </div>`;
  }

  function exportCurrentReport(){
    const records=reportFilteredRecords();
    const def=reportDefinition(reportKey,records);
    const headers=def.tableHeaders||[];
    const rows=def.tableRows||[];
    if(!rows.length){showToast("There is no report data to download");return}
    const csv=[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\n");
    const safe=String(def.title||"report").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    download(csv,`animo-${safe||"report"}.csv`,"text/csv;charset=utf-8");
    showToast("Report table downloaded");
  }

  function renderAdminDetails(){return `<div class="admin-panel-heading"><div><p class="eyebrow">Event configuration</p><h2>Core tournament details</h2><p>These values define the public tournament information.</p></div><span class="status-pill">Configuration</span></div><div class="admin-form-grid">${adminField("Tournament name","name",adminDraft.name)}${adminField("Organizer","organizer",adminDraft.organizer)}${adminField("Event date","eventDate",adminDraft.eventDate,"date")}${adminField("Venue","venue",adminDraft.venue)}${adminField("Registration opens","registrationOpening",adminDraft.registrationOpening,"date")}${adminField("Registration deadline","registrationDeadline",adminDraft.registrationDeadline,"date")}${adminField("Final player confirmation","finalPlayerConfirmation",adminDraft.finalPlayerConfirmation,"date")}${adminField("Schedule release","scheduleRelease",adminDraft.scheduleRelease,"date")}${adminField("Number of courts","numberOfCourts",adminDraft.numberOfCourts,"number")}${adminTextarea("Participant eligibility","eligibilitySummary",adminDraft.eligibilitySummary)}${adminTextarea("Tournament format summary","formatSummary",adminDraft.formatSummary)}</div>`}
  function renderAdminDivisions(){const divisions=adminDraft.divisions||[];return `<div class="admin-panel-heading"><div><p class="eyebrow">Registration architecture</p><h2>Divisions, fees & capacity</h2><p>PHP 1,800 per player. Each division is mapped to a level used by both DUPR-based and no-DUPR validation paths; double entry is disabled.</p></div><button class="button button-ghost" id="addDivisionButton" type="button">+ Add Division</button></div><div class="admin-division-list">${divisions.map((d,i)=>`<article class="admin-division-card"><header><div><span class="admin-index">${String(i+1).padStart(2,"0")}</span><strong>${esc(d.name||"Untitled division")}</strong></div><div class="admin-card-actions"><label class="switch-label"><input type="checkbox" data-division-index="${i}" data-division-field="enabled" ${d.enabled?"checked":""}/> Enabled</label><button class="icon-button danger" type="button" data-remove-division="${i}">×</button></div></header><div class="admin-form-grid compact">${adminDivisionField(i,"Division name","name",d.name)}${adminDivisionLevelSelect(i,d.levelKey)}${adminDivisionField(i,"Classification","classification",d.classification)}${adminDivisionField(i,"Description","description",d.description)}${adminDivisionField(i,"Eligibility","eligibility",d.eligibility)}${adminDivisionField(i,"Fee per player","fee",d.fee,"number")}${adminDivisionField(i,"Maximum participants","maxParticipants",d.maxParticipants,"number")}${adminDivisionField(i,"Capacity (pair/team slots)","capacity",d.capacity,"number")}${adminDivisionField(i,"Team slots remaining","slotsRemaining",d.slotsRemaining,"number")}</div></article>`).join("")}</div>`}
  function adminDivisionField(index,label,fieldName,value,type="text"){return `<label class="field"><span>${esc(label)}</span><input type="${type}" data-division-index="${index}" data-division-field="${esc(fieldName)}" value="${esc(value??"")}"/></label>`}
  function adminDivisionLevelSelect(index,value){
    const opts=[["beginner","Beginner"],["lowIntermediate","Low Intermediate"],["highIntermediate","High Intermediate"],["advanced","Advanced"]];
    return `<label class="field"><span>DUPR level mapping</span><select data-division-index="${index}" data-division-field="levelKey">${opts.map(([v,l])=>`<option value="${v}" ${v===value?"selected":""}>${l}</option>`).join("")}</select><small>Only players provisionally assigned to this level can select the division.</small></label>`;
  }
  function adminDuprField(label,path,value,helper=""){return `<label class="field"><span>${esc(label)}</span><input type="number" step="0.01" inputmode="decimal" data-admin-path="${esc(path)}" value="${esc(value??"")}"/>${helper?`<small>${esc(helper)}</small>`:""}</label>`}
  function renderAdminDuprRules(){
    const t=adminDraft.duprEligibility?.thresholds||{};
    return `<div class="admin-panel-heading"><div><p class="eyebrow">Level eligibility engine</p><h2>DUPR & Validation Rules</h2><p>These are tournament-defined DUPR thresholds. Players without DUPR may request a level, but the request remains provisional until the organizer validates the registration.</p></div><span class="status-pill">Organizer validation</span></div>
      <div class="admin-form-grid">${adminDuprField("Low Intermediate starts at","duprEligibility.thresholds.lowIntermediateMin",t.lowIntermediateMin,"Ratings below this remain Beginner.")}${adminDuprField("High Intermediate starts at","duprEligibility.thresholds.highIntermediateMin",t.highIntermediateMin,"Must be higher than the Low Intermediate threshold.")}${adminDuprField("Advanced starts at","duprEligibility.thresholds.advancedMin",t.advancedMin,"Ratings at or above this threshold are Advanced.")}</div>
      <div class="admin-rule-note"><strong>Verification & pair rules</strong><p>DUPR players submit a rating with screenshot proof. No-DUPR players request a level and submit Club Affiliation, a club DUPR/Facebook page link, and playing history. Approving the registration validates the requested level unless Admin changes it first. Partners must be in the same level. Gender is limited to Male or Female and automatically determines Men's, Women's, or Mixed Doubles. Payment may proceed once the pair has matching provisional levels and an automatic division assignment.</p></div>`;
  }
  function renderAdminHero(){const slides=adminDraft.heroCarousel?.slides||[];return `<div class="admin-panel-heading"><div><p class="eyebrow">Homepage hero</p><h2>Campaign carousel</h2><p>Edit the messaging used on the public registration homepage.</p></div><button class="button button-ghost" id="addHeroSlideButton" type="button" ${slides.length>=5?"disabled":""}>+ Add Slide</button></div><div class="admin-inline-settings">${adminField("Autoplay interval (ms)","heroCarousel.autoplayMs",adminDraft.heroCarousel?.autoplayMs||6500,"number")}</div><div class="admin-hero-list">${slides.map((slide,i)=>`<article class="admin-hero-card"><div class="admin-hero-preview campaign-preview ${slide.contentPosition==="left"?"align-left":""}" ${slide.image?`style="background-image:linear-gradient(180deg,rgba(0,0,0,.03),rgba(0,0,0,.5)),url('${esc(slide.image)}');background-position:${esc(slide.imagePosition||"center")}"`:""}><span>${esc(slide.eyebrow||"Hero slide")}</span><strong>${nl2br(slide.headline||"Untitled slide")}</strong><small>${esc(slide.primaryCtaLabel||"Register Now")}</small></div><header><div><span class="admin-index">Slide ${i+1}</span><strong>${esc((slide.headline||"Untitled slide").split("\n")[0])}</strong></div><button class="icon-button danger" type="button" data-remove-hero="${i}" ${slides.length<=1?"disabled":""}>×</button></header><div class="admin-form-grid compact">${adminHeroField(i,"Eyebrow","eyebrow",slide.eyebrow)}${adminHeroField(i,"Headline","headline",slide.headline)}${adminHeroField(i,"Supporting copy","body",slide.body)}${adminHeroField(i,"Primary CTA label","primaryCtaLabel",slide.primaryCtaLabel||"Register Now")}${adminHeroSelect(i,"Image focal point","imagePosition",slide.imagePosition||"center",[["center","Center"],["top","Top"],["bottom","Bottom"],["left","Left"],["right","Right"]])}${adminHeroSelect(i,"Content position","contentPosition",slide.contentPosition||"center",[["center","Centered"],["left","Bottom left"]])}${adminHeroField(i,"Image URL","image",slide.image,"url")}${adminHeroField(i,"Image alt text","imageAlt",slide.imageAlt)}</div></article>`).join("")}</div>`}
  function adminHeroField(index,label,fieldName,value,type="text"){return `<label class="field ${fieldName==="body"||fieldName==="headline"?"full":""}"><span>${esc(label)}</span>${fieldName==="body"||fieldName==="headline"?`<textarea data-hero-index="${index}" data-hero-field="${esc(fieldName)}">${esc(value||"")}</textarea>`:`<input type="${type}" data-hero-index="${index}" data-hero-field="${esc(fieldName)}" value="${esc(value||"")}"/>`}</label>`}
  function adminHeroSelect(index,label,fieldName,value,options){return `<label class="field"><span>${esc(label)}</span><select data-hero-index="${index}" data-hero-field="${esc(fieldName)}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?"selected":""}>${esc(l)}</option>`).join("")}</select></label>`}
  function renderAdminFaq(){const items=adminDraft.faq||[];return `<div class="admin-panel-heading"><div><p class="eyebrow">Participant guidance</p><h2>Registration FAQ</h2><p>Edit the answers shown to players.</p></div><button class="button button-ghost" id="addFaqButton" type="button">+ Add FAQ</button></div><div class="admin-faq-list">${items.map((item,i)=>`<article class="admin-faq-card"><header><div><span class="admin-index">${String(i+1).padStart(2,"0")}</span><strong>${esc(item.q||"Untitled question")}</strong></div><button class="icon-button danger" type="button" data-remove-faq="${i}">×</button></header><div class="admin-form-grid"><label class="field full"><span>Question</span><input type="text" data-faq-index="${i}" data-faq-field="q" value="${esc(item.q||"")}"/></label><label class="field full"><span>Answer</span><textarea class="faq-answer-editor" data-faq-index="${i}" data-faq-field="a">${esc(item.a||"")}</textarea></label></div></article>`).join("")}</div>`}
  function renderAdminContact(){const c=adminDraft.contact||{};return `<div class="admin-panel-heading"><div><p class="eyebrow">Participant support</p><h2>Organizer contact</h2><p>Support details used by the player registration portal.</p></div></div><div class="admin-form-grid">${adminField("Contact name","contact.name",c.name)}${adminField("Email","contact.email",c.email,"email")}${adminField("Mobile","contact.mobile",c.mobile,"tel")}${adminField("Privacy policy URL","contact.privacyUrl",c.privacyUrl,"url")}</div>`}


  // =========================================================
  // ACCESS & ROLES — Director-controlled permissions
  // =========================================================
  function roleMemberCount(roleId){
    return getAccessControl().members.filter(m=>m.roleId===roleId&&m.status==="Active").length;
  }

  function accessPermissionGroups(){
    const groups={};
    PERMISSIONS.forEach(p=>(groups[p.group]??=[]).push(p));
    return groups;
  }

  function accessRoleCards(){
    const access=getAccessControl();
    return `<div class="access-role-list">${access.roles.map(role=>`<button class="access-role-card ${accessSelectedRoleId===role.id?"active":""}" type="button" data-access-role="${esc(role.id)}">
      <div><span>${role.id==="director"?"FULL ACCESS":role.protected?"PRESET ROLE":"CUSTOM ROLE"}</span><strong>${esc(role.name)}</strong><small>${esc(role.description||"Custom permission set")}</small></div>
      <b>${roleMemberCount(role.id)} member${roleMemberCount(role.id)===1?"":"s"}</b>
    </button>`).join("")}</div>`;
  }

  function accessPermissionEditor(){
    const role=roleById(accessSelectedRoleId)||roleById("admin");
    const director=role.id==="director";
    const groups=accessPermissionGroups();
    return `<section class="access-permission-editor">
      <div class="access-editor-head">
        <div>
          <span class="eyebrow">Role permissions</span>
          <h3>${esc(role.name)}</h3>
          <p>${director?"Director is permanently configured with full control so the tournament cannot be locked out.":"Choose exactly what this role can see and change. Changes save immediately."}</p>
        </div>
        <div class="access-editor-actions">
          ${!role.protected?`<button class="button button-ghost" id="renameAccessRole" type="button">Rename Role</button><button class="button button-ghost danger-text" id="deleteAccessRole" type="button">Delete Role</button>`:""}
        </div>
      </div>
      <div class="access-permission-groups">
        ${Object.entries(groups).map(([group,permissions])=>`<article class="access-permission-group">
          <header><strong>${esc(group)}</strong><span>${permissions.filter(p=>role.permissions.includes(p.id)||director).length}/${permissions.length}</span></header>
          <div class="access-permission-list">
            ${permissions.map(permission=>{
              const locked=director||permission.directorOnly;
              const checked=director||role.permissions.includes(permission.id);
              return `<label class="access-permission-row ${locked?"locked":""}">
                <div><strong>${esc(permission.label)}</strong><small>${esc(permission.help)}</small>${permission.directorOnly?`<em>Director only</em>`:""}</div>
                <input type="checkbox" data-role-permission="${esc(permission.id)}" ${checked?"checked":""} ${locked?"disabled":""}/>
                <span class="access-toggle" aria-hidden="true"></span>
              </label>`;
            }).join("")}
          </div>
        </article>`).join("")}
      </div>
    </section>`;
  }

  function accessMembersTable(){
    const access=getAccessControl();
    return `<section class="access-members-section">
      <div class="access-section-head">
        <div><span class="eyebrow">Role assignments</span><h3>Team Members</h3><p>Assign each organizer one role. Their available pages and actions follow that role's permissions.</p></div>
        <button class="button button-primary" id="addAccessMember" type="button">Add Team Member</button>
      </div>
      <div class="access-member-table-wrap">
        <table class="access-member-table">
          <thead><tr><th>Team member</th><th>Role</th><th>Status</th><th>Access</th><th></th></tr></thead>
          <tbody>
            ${access.members.map(member=>{
              const role=access.roles.find(r=>r.id===member.roleId);
              const isLastDirector=member.roleId==="director"&&member.status==="Active"&&access.members.filter(m=>m.roleId==="director"&&m.status==="Active").length===1;
              return `<tr>
                <td><div class="access-member-person"><strong>${esc(member.name)}</strong><span>${esc(member.email||"No email entered")}</span></div></td>
                <td><select data-member-role="${esc(member.id)}" ${isLastDirector?"data-last-director=true":""}>${access.roles.map(r=>`<option value="${esc(r.id)}" ${r.id===member.roleId?"selected":""}>${esc(r.name)}</option>`).join("")}</select></td>
                <td><select data-member-status="${esc(member.id)}" ${isLastDirector?"data-last-director=true":""}><option ${member.status==="Active"?"selected":""}>Active</option><option ${member.status==="Disabled"?"selected":""}>Disabled</option></select></td>
                <td><span class="access-member-permission-count">${role?.id==="director"?PERMISSIONS.length:role?.permissions.length||0} permissions</span></td>
                <td><div class="access-member-actions"><button type="button" data-edit-member="${esc(member.id)}">Edit</button><button class="danger" type="button" data-remove-member="${esc(member.id)}" ${isLastDirector?"disabled title='At least one active Director is required'":""}>Remove</button></div></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>`;
  }

  function accessAuditMarkup(){
    const rows=getAccessAudit().slice(0,10);
    return `<section class="access-audit-section">
      <div class="access-section-head"><div><span class="eyebrow">Accountability</span><h3>Recent Access Changes</h3><p>Tracks role and permission changes made in this browser preview.</p></div></div>
      <div class="access-audit-list">${rows.length?rows.map(row=>`<div><span>${esc(new Date(row.at).toLocaleString("en-PH"))}</span><strong>${esc(row.action)}</strong><small>by ${esc(row.actor||"Director")}</small></div>`).join(""):`<div class="access-audit-empty">No access changes yet.</div>`}</div>
    </section>`;
  }

  function accessDialogMarkup(){
    const access=getAccessControl();
    const member=accessEditingMemberId?access.members.find(m=>m.id===accessEditingMemberId):null;
    return `<dialog class="access-dialog" id="accessMemberDialog">
      <form method="dialog" class="access-dialog-card">
        <div class="access-dialog-head">
          <div><span class="eyebrow">${member?"Edit assignment":"Add access"}</span><h3>${member?"Update Team Member":"Add Team Member"}</h3><p>${member?"Update this person's name, email, or role assignment.":"Add an organizer and assign their role."}</p></div>
          <button type="submit" value="cancel" aria-label="Close">×</button>
        </div>
        <div class="access-dialog-grid">
          <label class="field"><span>Name</span><input id="accessMemberName" value="${esc(member?.name||"")}" placeholder="Organizer name" /></label>
          <label class="field"><span>Email</span><input id="accessMemberEmail" type="email" value="${esc(member?.email||"")}" placeholder="name@example.com" /></label>
          <label class="field"><span>Role</span><select id="accessMemberRole">${access.roles.map(r=>`<option value="${esc(r.id)}" ${r.id===(member?.roleId||"admin")?"selected":""}>${esc(r.name)}</option>`).join("")}</select></label>
        </div>
        <div class="access-dialog-actions"><button class="button button-ghost" value="cancel" type="submit">Cancel</button><button class="button button-primary" id="saveAccessMember" type="button">${member?"Save Assignment":"Add Team Member"}</button></div>
      </form>
    </dialog>

    <dialog class="access-dialog" id="accessRoleDialog">
      <form method="dialog" class="access-dialog-card">
        <div class="access-dialog-head"><div><span class="eyebrow">Custom role</span><h3>Create a New Role</h3><p>Create a role, then choose its permissions.</p></div><button type="submit" value="cancel" aria-label="Close">×</button></div>
        <div class="access-dialog-grid single">
          <label class="field"><span>Role name</span><input id="newAccessRoleName" placeholder="Example: Registration Lead" /></label>
          <label class="field"><span>Description</span><input id="newAccessRoleDescription" placeholder="What this role is responsible for" /></label>
        </div>
        <div class="access-dialog-actions"><button class="button button-ghost" value="cancel" type="submit">Cancel</button><button class="button button-primary" id="saveNewAccessRole" type="button">Create Role</button></div>
      </form>
    </dialog>`;
  }

  function renderAdminAccess(){
    if(!can("access.manage"))return `<div class="empty-state"><strong>Access restricted.</strong>This section is available to the Director only.</div>`;
    const access=getAccessControl();
    if(!access.roles.some(r=>r.id===accessSelectedRoleId))accessSelectedRoleId="admin";
    return `<div class="access-page">
      <div class="admin-panel-heading">
        <div><p class="eyebrow">Director controls</p><h2>Access & Roles</h2><p>Signed-in access is now verified by Supabase. The role editor below remains an interface preview until server-side role-management functions are connected.</p></div>
        <button class="button button-ghost" id="addAccessRole" type="button">+ Add Custom Role</button>
      </div>
      <div class="access-backend-note"><strong>Supabase is the authority for your current login.</strong><span>Changing a role below does not yet change the Supabase database. We will connect Director role-management actions in the next backend phase.</span></div>

      <div class="access-director-note">
        <div class="access-director-icon">D</div>
        <div><strong>Director always has full control</strong><span>Director permissions are locked on, and the system keeps at least one active Director assignment to prevent accidental lockout.</span></div>
      </div>

      <div class="access-role-workspace">
        <aside>${accessRoleCards()}</aside>
        ${accessPermissionEditor()}
      </div>

      ${accessMembersTable()}
      ${accessAuditMarkup()}
      ${accessDialogMarkup()}
    </div>`;
  }

  function accessUpdatePermission(permissionId,enabled){
    if(!can("access.manage"))return;
    const access=getAccessControl();
    const role=access.roles.find(r=>r.id===accessSelectedRoleId);
    const permission=PERMISSIONS.find(p=>p.id===permissionId);
    if(!role||role.id==="director"||permission?.directorOnly)return;
    const set=new Set(role.permissions);
    enabled?set.add(permissionId):set.delete(permissionId);
    role.permissions=[...set];
    saveAccessControl(access,`${enabled?"Granted":"Removed"} permission: ${permission?.label||permissionId}`,{roleId:role.id,permissionId});
    refreshAccessChrome();
    showToast("Role permissions updated");
  }

  function accessAddRole(){
    accessDialogMode="new-role";
    accessEditingMemberId=null;
    const dialog=$("#accessRoleDialog");
    if(dialog?.showModal)dialog.showModal();
  }

  function accessSaveNewRole(){
    const name=String($("#newAccessRoleName")?.value||"").trim();
    const description=String($("#newAccessRoleDescription")?.value||"").trim();
    if(!name){showToast("Enter a role name");return}
    const access=getAccessControl();
    const base=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"custom-role";
    let id=base,n=2;
    while(access.roles.some(r=>r.id===id))id=`${base}-${n++}`;
    access.roles.push({id,name,description,protected:false,permissions:["registrations.view"]});
    saveAccessControl(access,`Created role: ${name}`,{roleId:id});
    accessSelectedRoleId=id;
    $("#accessRoleDialog")?.close();
    renderAdmin();
    showToast("Custom role created");
  }

  function accessRenameRole(){
    const access=getAccessControl();
    const role=access.roles.find(r=>r.id===accessSelectedRoleId);
    if(!role||role.protected)return;
    const name=prompt("Rename this role:",role.name);
    if(name===null||!String(name).trim())return;
    role.name=String(name).trim();
    saveAccessControl(access,`Renamed role to: ${role.name}`,{roleId:role.id});
    renderAdmin();
  }

  function accessDeleteRole(){
    const access=getAccessControl();
    const role=access.roles.find(r=>r.id===accessSelectedRoleId);
    if(!role||role.protected)return;
    const assigned=access.members.filter(m=>m.roleId===role.id).length;
    if(assigned){showToast("Reassign members before deleting this role");return}
    if(!confirm(`Delete the role "${role.name}"?`))return;
    access.roles=access.roles.filter(r=>r.id!==role.id);
    saveAccessControl(access,`Deleted role: ${role.name}`,{roleId:role.id});
    accessSelectedRoleId="admin";
    renderAdmin();
  }

  function accessOpenMemberDialog(memberId=null){
    accessEditingMemberId=memberId;
    renderAdmin();
    const dialog=$("#accessMemberDialog");
    if(dialog?.showModal)dialog.showModal();
  }

  function accessSaveMember(){
    const name=String($("#accessMemberName")?.value||"").trim();
    const email=String($("#accessMemberEmail")?.value||"").trim().toLowerCase();
    const roleId=$("#accessMemberRole")?.value||"admin";
    if(!name){showToast("Enter the team member's name");return}
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showToast("Enter a valid email address");return}

    const access=getAccessControl();
    if(email&&access.members.some(m=>m.email===email&&m.id!==accessEditingMemberId)){showToast("That email already has an access assignment");return}

    if(accessEditingMemberId){
      const member=access.members.find(m=>m.id===accessEditingMemberId);
      if(!member)return;
      if(member.roleId==="director"&&member.status==="Active"&&roleId!=="director"&&access.members.filter(m=>m.roleId==="director"&&m.status==="Active").length===1){
        showToast("Assign another active Director first");return;
      }
      const oldRole=roleById(member.roleId)?.name||member.roleId;
      Object.assign(member,{name,email,roleId});
      saveAccessControl(access,`Updated role assignment for ${name}`,{from:oldRole,to:roleById(roleId)?.name||roleId});
    }else{
      const member={id:`member-${Date.now()}`,name,email,roleId,status:"Active",createdAt:new Date().toISOString()};
      access.members.push(member);
      saveAccessControl(access,`Added team member: ${name}`,{role:roleById(roleId)?.name||roleId});
    }

    accessEditingMemberId=null;
    $("#accessMemberDialog")?.close();
    renderAdmin();
    showToast("Role assignment saved");
  }

  function accessChangeMemberRole(memberId,roleId){
    const access=getAccessControl();
    const member=access.members.find(m=>m.id===memberId);
    if(!member)return;
    const activeDirectors=access.members.filter(m=>m.roleId==="director"&&m.status==="Active").length;
    if(member.roleId==="director"&&member.status==="Active"&&roleId!=="director"&&activeDirectors===1){
      showToast("Assign another active Director first");renderAdmin();return;
    }
    const old=roleById(member.roleId)?.name||member.roleId;
    member.roleId=roleId;
    saveAccessControl(access,`Changed ${member.name}'s role`,{from:old,to:roleById(roleId)?.name||roleId});
    renderAdmin();
  }

  function accessChangeMemberStatus(memberId,status){
    const access=getAccessControl();
    const member=access.members.find(m=>m.id===memberId);
    if(!member)return;
    const activeDirectors=access.members.filter(m=>m.roleId==="director"&&m.status==="Active").length;
    if(member.roleId==="director"&&member.status==="Active"&&status==="Disabled"&&activeDirectors===1){
      showToast("At least one Director must stay active");renderAdmin();return;
    }
    member.status=status==="Disabled"?"Disabled":"Active";
    saveAccessControl(access,`${member.status==="Active"?"Enabled":"Disabled"} access for ${member.name}`,{memberId});
    renderAdmin();
  }

  function accessRemoveMember(memberId){
    const access=getAccessControl();
    const member=access.members.find(m=>m.id===memberId);
    if(!member)return;
    const activeDirectors=access.members.filter(m=>m.roleId==="director"&&m.status==="Active").length;
    if(member.roleId==="director"&&member.status==="Active"&&activeDirectors===1){
      showToast("At least one Director must stay active");return;
    }
    if(!confirm(`Remove access for ${member.name}?`))return;
    access.members=access.members.filter(m=>m.id!==memberId);
    saveAccessControl(access,`Removed access for ${member.name}`,{memberId});
    renderAdmin();
  }

  // =========================================================
  // EMAIL NOTIFICATIONS — interface preview before Supabase
  // =========================================================
  function emailStatusFlow(){
    const items=[
      ["1","Registration","Received"],
      ["2","Verification","Review"],
      ["3","Approved","Accepted"],
      ["4","Confirmed","Ready"]
    ];
    return `<div class="email-flow">${items.map(([num,title,state],i)=>`<div class="email-flow-step"><div class="email-flow-marker">${num}</div><div><strong>${esc(title)}</strong><span>${esc(state)}</span></div>${i<items.length-1?`<i>→</i>`:""}</div>`).join("")}</div>`;
  }

  function emailTemplateList(settings){
    return `<div class="email-template-list">${settings.templates.map(template=>`<button class="email-template-item ${template.id===selectedEmailTemplateId?"active":""}" type="button" data-email-template="${esc(template.id)}">
      <div class="email-template-dot ${template.enabled?"enabled":"disabled"}"></div>
      <div><strong>${esc(template.label)}</strong><span>${esc(template.trigger)}</span></div>
      <small>${template.enabled?"On":"Off"}</small>
    </button>`).join("")}</div>`;
  }

  function emailVariablesMarkup(){
    const tokens=[
      "{{player_name}}","{{partner_name}}","{{registration_reference}}","{{division}}",
      "{{level}}","{{event_date}}","{{venue}}","{{action_reason}}","{{decision_reason}}"
    ];
    return `<div class="email-token-list">${tokens.map(token=>`<button type="button" data-email-token="${esc(token)}">${esc(token)}</button>`).join("")}</div>`;
  }

  function emailPreviewMarkup(template,settings){
    const subject=renderEmailTokens(template.subject);
    const headline=renderEmailTokens(template.headline);
    const body=renderEmailTokens(template.body);
    const cta=renderEmailTokens(template.ctaLabel);
    return `<div class="email-preview-shell">
      <div class="email-preview-client">
        <div class="email-preview-toolbar"><span></span><span></span><span></span><b>Email Preview</b></div>
        <div class="email-preview-meta">
          <div><span>From</span><strong>${esc(settings.senderName||config.name)}</strong></div>
          <div><span>To</span><strong>Juan Dela Cruz &lt;player@example.com&gt;</strong></div>
          <div><span>Subject</span><strong>${esc(subject)}</strong></div>
        </div>
        <div class="email-preview-message tone-${esc(template.tone||"received")}">
          <div class="email-brand-mark">A</div>
          <span class="email-preview-eyebrow">${esc(config.name||"Animo Pickleball Cup 2026")}</span>
          <h3>${esc(headline)}</h3>
          <div class="email-preview-body">${esc(body).replace(/\n/g,"<br />")}</div>
          ${cta?`<div class="email-preview-cta">${esc(cta)}</div>`:""}
          <div class="email-preview-footer">${esc(settings.footer||"")}</div>
        </div>
      </div>
    </div>`;
  }

  function emailActivityTableMarkup(){
    const rows=getEmailActivity();
    if(!rows.length){
      return `<div class="email-activity-empty">
        <div class="email-activity-icon">✉</div>
        <strong>No automatic email triggers yet</strong>
        <span>Try changing a registration to Approved or Confirmed. The corresponding Player 1 / Player 2 email events will appear here automatically.</span>
      </div>`;
    }

    return `<div class="email-activity-table-wrap">
      <table class="email-activity-table">
        <thead><tr><th>Triggered</th><th>Registration</th><th>Notification</th><th>Recipient</th><th>Trigger</th><th>Preview result</th></tr></thead>
        <tbody>${rows.slice(0,80).map(row=>`<tr>
          <td><strong>${esc(new Date(row.at).toLocaleDateString("en-PH",{month:"short",day:"numeric"}))}</strong><span>${esc(new Date(row.at).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"}))}</span></td>
          <td><strong>${esc(row.reference||"—")}</strong></td>
          <td><strong>${esc(row.templateLabel||row.templateId||"Notification")}</strong></td>
          <td><strong>${esc(row.recipientName||"Player")}</strong><span>${esc(row.recipientEmail||"No email on file")}</span></td>
          <td><span>${esc(row.source||"Registration event")}</span></td>
          <td><span class="email-activity-status ${emailActivityStatusClass(row.result)}">${esc(row.result||"Triggered")}${row.result==="Triggered"?" · Not Sent":""}</span><small>${esc(row.detail||"")}</small></td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
  }

  function renderAdminNotifications(){
    if(!can("notifications.manage"))return `<div class="empty-state"><strong>Access restricted.</strong>Your role does not have permission to manage email notifications.</div>`;

    const settings=getEmailNotificationSettings();
    if(!settings.templates.some(t=>t.id===selectedEmailTemplateId))selectedEmailTemplateId=settings.templates[0]?.id||"registration_received";
    const template=settings.templates.find(t=>t.id===selectedEmailTemplateId)||settings.templates[0];
    const enabledCount=settings.templates.filter(t=>t.enabled).length;

    return `<div class="email-notification-page">
      <div class="admin-panel-heading email-page-heading">
        <div>
          <p class="eyebrow">Player communication</p>
          <h2>Email Notifications</h2>
          <p>Design the emails players will receive as their registration moves from submission to final confirmation.</p>
        </div>
        <div class="email-page-actions">
          <button class="button button-primary" id="saveEmailNotifications" type="button">Save Notification Settings</button>
        </div>
      </div>

      <div class="email-preview-mode-note">
        <div class="email-preview-mode-icon">!</div>
        <div>
          <strong>Interface preview — email delivery is not connected yet</strong>
          <span>Automatic triggers are active in this interface preview. Relevant actions create Player 1 / Player 2 email events immediately, but actual delivery starts only after Supabase and the email service are connected.</span>
        </div>
        <span class="email-connection-badge">Not Connected</span>
      </div>

      <div class="email-kpi-grid">
        <article><span>Notification templates</span><strong>${settings.templates.length}</strong><small>Player-facing email events</small></article>
        <article><span>Currently enabled</span><strong>${enabledCount}</strong><small>Templates switched on</small></article>
        <article><span>Delivery service</span><strong>Offline</strong><small>Supabase connection pending</small></article>
        <article><span>Automatic triggers</span><strong>${getEmailActivity().filter(row=>row.result==="Triggered").length}</strong><small>Preview events generated by registration actions</small></article>
      </div>

      <section class="email-master-card">
        <div>
          <span class="eyebrow">Master setting</span>
          <h3>Player email notifications</h3>
          <p>Turn the complete notification workflow on or off. Individual messages can still be configured below.</p>
        </div>
        <label class="email-master-toggle">
          <input id="emailMasterEnabled" type="checkbox" ${settings.enabled?"checked":""}/>
          <span></span>
          <strong>${settings.enabled?"Enabled":"Disabled"}</strong>
        </label>
      </section>

      ${emailStatusFlow()}

      <section class="email-auto-trigger-card">
        <div class="email-auto-trigger-icon">⚡</div>
        <div>
          <span class="eyebrow">Automatic workflow</span>
          <h3>No manual Send button required</h3>
          <p>When an authorized organizer changes a relevant registration status, the matching email notification is triggered automatically. For example: <strong>Confirmed → Officially Confirmed email → Player 1 + Player 2.</strong></p>
        </div>
      </section>

      <section class="email-settings-card">
        <div class="email-settings-head">
          <div><span class="eyebrow">Sender details</span><h3>How emails will appear</h3></div>
        </div>
        <div class="email-settings-grid">
          <label class="field"><span>Sender name</span><input id="emailSenderName" value="${esc(settings.senderName)}" placeholder="Animo Pickleball Cup 2026" /></label>
          <label class="field"><span>Reply-to email</span><input id="emailReplyTo" type="email" value="${esc(settings.replyTo)}" placeholder="organizer@example.com" /></label>
          <label class="field email-footer-field"><span>Email footer</span><input id="emailFooter" value="${esc(settings.footer)}" /></label>
        </div>
      </section>

      <div class="email-workspace">
        <aside class="email-template-sidebar">
          <div class="email-template-sidebar-head">
            <span class="eyebrow">Messages</span>
            <h3>Notification Templates</h3>
            <p>Select a notification to edit and preview.</p>
          </div>
          ${emailTemplateList(settings)}
        </aside>

        <section class="email-template-editor">
          <div class="email-editor-head">
            <div>
              <span class="eyebrow">Selected notification</span>
              <h3>${esc(template.label)}</h3>
              <p>${esc(template.trigger)}</p>
            </div>
            <label class="email-template-switch">
              <input id="emailTemplateEnabled" type="checkbox" ${template.enabled?"checked":""}/>
              <span></span>
              <strong>${template.enabled?"Enabled":"Disabled"}</strong>
            </label>
          </div>

          <div class="email-editor-meta">
            <div><span>Sent to</span><strong>${esc(template.recipients)}</strong></div>
            <div><span>Trigger</span><strong>${esc(template.trigger)}</strong></div>
          </div>

          <div class="email-editor-grid">
            <div class="email-editor-fields">
              <label class="field"><span>Subject line</span><input id="emailTemplateSubject" value="${esc(template.subject)}" /></label>
              <label class="field"><span>Email headline</span><input id="emailTemplateHeadline" value="${esc(template.headline)}" /></label>
              <label class="field"><span>Message</span><textarea id="emailTemplateBody" rows="11">${esc(template.body)}</textarea></label>
              <div class="email-cta-grid">
                <label class="field"><span>Button label</span><input id="emailTemplateCtaLabel" value="${esc(template.ctaLabel)}" /></label>
                <label class="field"><span>Button link</span><input id="emailTemplateCtaUrl" value="${esc(template.ctaUrl)}" /></label>
              </div>

              <div class="email-variables-card">
                <strong>Personalization fields</strong>
                <span>Use these placeholders inside the subject or message. Real registration data will replace them when emails are connected.</span>
                ${emailVariablesMarkup()}
              </div>
            </div>

            <div class="email-preview-column">
              <div class="email-preview-column-head">
                <div><span class="eyebrow">Live preview</span><h3>What the player sees</h3></div>
                <button class="button button-ghost" id="refreshEmailPreview" type="button">Refresh Preview</button>
              </div>
              <div id="emailTemplatePreview">${emailPreviewMarkup(template,settings)}</div>
            </div>
          </div>
        </section>
      </div>

      <section class="email-activity-card">
        <div class="email-activity-head">
          <div><span class="eyebrow">Automatic trigger log</span><h3>Email Activity</h3><p>Relevant registration actions automatically create email events. During interface testing they are logged here but are not actually delivered.</p></div>
          <div class="email-activity-head-actions"><span class="email-connection-badge">Preview Mode</span>${getEmailActivity().length?`<button class="button button-ghost" id="clearEmailPreviewActivity" type="button">Clear Preview Log</button>`:""}</div>
        </div>
        ${emailActivityTableMarkup()}
      </section>
    </div>`;
  }

  function updateCurrentEmailTemplateFromForm(settings){
    const template=settings.templates.find(t=>t.id===selectedEmailTemplateId);
    if(!template)return settings;
    const enabled=$("#emailTemplateEnabled");
    const subject=$("#emailTemplateSubject");
    const headline=$("#emailTemplateHeadline");
    const body=$("#emailTemplateBody");
    const cta=$("#emailTemplateCtaLabel");
    const url=$("#emailTemplateCtaUrl");
    if(enabled)template.enabled=enabled.checked;
    if(subject)template.subject=subject.value;
    if(headline)template.headline=headline.value;
    if(body)template.body=body.value;
    if(cta)template.ctaLabel=cta.value;
    if(url)template.ctaUrl=url.value;
    return settings;
  }

  function saveEmailNotificationForm(){
    if(!can("notifications.manage")){showToast("Your role cannot manage email notifications");return}
    let settings=getEmailNotificationSettings();
    settings=updateCurrentEmailTemplateFromForm(settings);
    const master=$("#emailMasterEnabled");
    const sender=$("#emailSenderName");
    const reply=$("#emailReplyTo");
    const footer=$("#emailFooter");
    if(master)settings.enabled=master.checked;
    if(sender)settings.senderName=sender.value.trim();
    if(reply)settings.replyTo=reply.value.trim();
    if(footer)settings.footer=footer.value.trim();
    saveEmailNotificationSettings(settings);
    recordAdminActivity("Configuration","Updated email notification settings",{
      template:selectedEmailTemplateId,
      workflow:settings.enabled?"Enabled":"Disabled"
    },{target:"Email Notifications"});
    renderAdmin();
  }

  function refreshEmailTemplatePreview(){
    let settings=getEmailNotificationSettings();
    settings=updateCurrentEmailTemplateFromForm(settings);
    const sender=$("#emailSenderName");
    const reply=$("#emailReplyTo");
    const footer=$("#emailFooter");
    if(sender)settings.senderName=sender.value.trim();
    if(reply)settings.replyTo=reply.value.trim();
    if(footer)settings.footer=footer.value.trim();
    const template=settings.templates.find(t=>t.id===selectedEmailTemplateId);
    const target=$("#emailTemplatePreview");
    if(target&&template)target.innerHTML=emailPreviewMarkup(template,settings);
  }

  // =========================================================
  // ACTIVITY LOG
  // =========================================================
  function activityKpis(rows){
    const now=new Date();
    const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    return {
      total:rows.length,
      today:rows.filter(row=>new Date(row.at).getTime()>=todayStart).length,
      registration:rows.filter(row=>row.category==="Registration"||row.category==="Eligibility").length,
      access:rows.filter(row=>row.category==="Access Control"||row.category==="Authentication").length,
      email:rows.filter(row=>row.category==="Email").length
    };
  }

  function renderAdminActivity(){
    if(!can("access.manage"))return `<div class="empty-state"><strong>Access restricted.</strong>The Activity Log is currently available to Directors only.</div>`;

    const all=allActivityRows();
    const rows=filteredActivityRows();
    const k=activityKpis(all);
    const categories=[...new Set(all.map(row=>row.category).filter(Boolean))].sort();
    const actors=[...new Set(all.map(row=>row.actorName).filter(Boolean))].sort();

    return `<div class="activity-page">
      <div class="admin-panel-heading activity-page-heading">
        <div>
          <p class="eyebrow">Accountability & oversight</p>
          <h2>Activity Log</h2>
          <p>Review meaningful organizer actions, access changes, registration decisions, and automatic notification events.</p>
        </div>
        <div class="activity-page-actions">
          <button class="button button-ghost" id="exportActivityLog" type="button">Download Activity Log</button>
          <button class="button button-ghost danger-text" id="clearLocalActivity" type="button">Clear Local Activity</button>
        </div>
      </div>

      <div class="activity-backend-note">
        <div class="activity-backend-icon">i</div>
        <div>
          <strong>Audit interface is active; permanent server logging is the next backend step.</strong>
          <span>This page currently combines Admin actions recorded on this device, Access & Roles history, and automatic email-trigger history. Once registration mutations move to Supabase, the same interface will read from the existing <b>audit_logs</b> table for permanent server-side accountability.</span>
        </div>
      </div>

      <div class="activity-kpi-grid">
        <article><span>Total activity</span><strong>${k.total}</strong><small>Across the available audit sources</small></article>
        <article><span>Today</span><strong>${k.today}</strong><small>Actions recorded today</small></article>
        <article><span>Registration / eligibility</span><strong>${k.registration}</strong><small>Player-related decisions and changes</small></article>
        <article><span>Access / authentication</span><strong>${k.access}</strong><small>Organizer access and sign-in activity</small></article>
        <article><span>Email workflow</span><strong>${k.email}</strong><small>Automatic notification events</small></article>
      </div>

      <section class="activity-filter-card">
        <label class="activity-search-field">
          <span>Search activity</span>
          <input id="activitySearch" type="search" value="${esc(activitySearch)}" placeholder="Registration reference, player, action, organizer…" />
        </label>
        <label>
          <span>Category</span>
          <select id="activityCategoryFilter">
            <option value="all">All categories</option>
            ${categories.map(category=>`<option value="${esc(category)}" ${activityCategoryFilter===category?"selected":""}>${esc(category)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Organizer / source</span>
          <select id="activityActorFilter">
            <option value="all">All actors</option>
            ${actors.map(actor=>`<option value="${esc(actor)}" ${activityActorFilter===actor?"selected":""}>${esc(actor)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Date range</span>
          <select id="activityDateFilter">
            <option value="1" ${activityDateFilter==="1"?"selected":""}>Last 24 hours</option>
            <option value="7" ${activityDateFilter==="7"?"selected":""}>Last 7 days</option>
            <option value="30" ${activityDateFilter==="30"?"selected":""}>Last 30 days</option>
            <option value="all" ${activityDateFilter==="all"?"selected":""}>All activity</option>
          </select>
        </label>
      </section>

      <section class="activity-table-card">
        <div class="activity-table-head">
          <div><strong>${rows.length} ${rows.length===1?"activity":"activities"}</strong><span>Newest activity appears first.</span></div>
          <div class="activity-legend">
            <span><i class="registration"></i>Registration</span>
            <span><i class="eligibility"></i>Eligibility</span>
            <span><i class="access"></i>Access</span>
            <span><i class="email"></i>Email</span>
          </div>
        </div>

        ${rows.length?`<div class="activity-table-wrap">
          <table class="activity-table">
            <thead><tr><th>Date & time</th><th>Actor</th><th>Category</th><th>Activity</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>${rows.map(row=>{
              const stamp=activityTimestamp(row.at);
              const tone=activityCategoryTone(row.category);
              return `<tr>
                <td class="activity-time"><strong>${esc(stamp.date)}</strong><span>${esc(stamp.time)}</span></td>
                <td><div class="activity-actor"><span class="activity-avatar">${esc((row.actorName||"S").slice(0,1).toUpperCase())}</span><div><strong>${esc(row.actorName||"System")}</strong><span>${esc(row.role||row.actorEmail||"")}</span></div></div></td>
                <td><span class="activity-category ${esc(tone)}">${esc(row.category||"System")}</span></td>
                <td><strong class="activity-action">${esc(row.action||"Activity")}</strong><span class="activity-source">${esc(row.source||"Admin Portal")}</span></td>
                <td><strong>${esc(row.target||row.reference||"—")}</strong></td>
                <td><span class="activity-details">${esc(row.details||"—")}</span>${row.result&&row.result!=="Completed"?`<small class="activity-result">${esc(row.result)}</small>`:""}</td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>`:`<div class="activity-empty">
          <div>↻</div>
          <strong>No activity matches these filters</strong>
          <span>Try another date range, category, organizer, or search term.</span>
        </div>`}
      </section>
    </div>`;
  }

  function renderAdminBackup(){
    const activeCount=getRecords().filter(r=>!r.deleted).length;
    return `<div class="admin-panel-heading">
      <div>
        <p class="eyebrow">Data safety</p>
        <h2>Backup & Restore</h2>
        <p>Keep a copy of your registration records and tournament setup. You normally do not need this during day-to-day registration review.</p>
      </div>
      <span class="status-pill">${activeCount} active registration${activeCount===1?"":"s"}</span>
    </div>

    <div class="backup-grid">
      <article class="backup-card">
        <div class="backup-card-icon" aria-hidden="true">↓</div>
        <div class="backup-card-copy">
          <span class="admin-index">SAVE A COPY</span>
          <h3>Download Backup</h3>
          <p>Save a complete copy of your current registration records and tournament settings to this device.</p>
        </div>
        <button class="button button-ghost" id="downloadBackupButton" type="button">Download Backup</button>
      </article>

      <article class="backup-card backup-card-warning">
        <div class="backup-card-icon" aria-hidden="true">↻</div>
        <div class="backup-card-copy">
          <span class="admin-index">RESTORE A COPY</span>
          <h3>Restore Backup</h3>
          <p>Restore registration records and settings from a backup you downloaded earlier.</p>
          <small>Restoring a backup replaces the registration records and saved setup currently stored on this device.</small>
        </div>
        <button class="button button-ghost" id="restoreBackupButton" type="button">Choose Backup File</button>
      </article>
    </div>

    <div class="backup-help">
      <strong>When should I use this?</strong>
      <p>Download a backup before making major registration changes, before tournament day, or before moving the admin site to another device.</p>
    </div>`;
  }

  function setDraftPath(path,value){const parts=path.split(".");let target=adminDraft;parts.slice(0,-1).forEach(k=>{target[k]??={};target=target[k]});target[parts.at(-1)]=value}
  function bindPanel(){
    if(adminTab==="registrations"){
      const s=$("#recordSearch"); if(s)s.oninput=()=>{searchTerm=s.value;renderAdmin()};
      const sf=$("#statusFilter"); if(sf)sf.onchange=()=>{statusFilter=sf.value;renderAdmin()};
      const df=$("#divisionFilter"); if(df)df.onchange=()=>{divisionFilter=df.value;renderAdmin()};
      $$('[data-view-record]').forEach(b=>b.onclick=()=>openRecord(b.dataset.viewRecord));
      $$('[data-status-record]').forEach(sel=>sel.onchange=()=>updateStatus(sel.dataset.statusRecord,sel.value));
      return;
    }
    if(adminTab==="reports"){
      const rk=$("#reportKey"); if(rk)rk.onchange=()=>{reportKey=rk.value;reportChartType="auto";renderAdmin()};
      const ct=$("#reportChartType"); if(ct)ct.onchange=()=>{reportChartType=ct.value;renderAdmin()};
      const dw=$("#reportDateWindow"); if(dw)dw.onchange=()=>{reportDateWindow=dw.value;renderAdmin()};
      const rs=$("#reportStatus"); if(rs)rs.onchange=()=>{reportStatus=rs.value;renderAdmin()};
      const rd=$("#reportDivision"); if(rd)rd.onchange=()=>{reportDivision=rd.value;renderAdmin()};
      const rl=$("#reportLevel"); if(rl)rl.onchange=()=>{reportLevel=rl.value;renderAdmin()};
      const rc=$("#reportCategory"); if(rc)rc.onchange=()=>{reportCategory=rc.value;renderAdmin()};
      const reset=$("#resetReportFilters"); if(reset)reset.onclick=()=>{reportStatus="all";reportDivision="all";reportLevel="all";reportCategory="all";reportDateWindow="all";renderAdmin()};
      const downloadReport=$("#downloadCurrentReport"); if(downloadReport)downloadReport.onclick=exportCurrentReport;
      const printReport=$("#printReportButton"); if(printReport)printReport.onclick=()=>window.print();

      const toggle=$("#toggleDashboardEdit");
      if(toggle)toggle.onclick=()=>{dashboardEditMode=!dashboardEditMode;dashboardConfigTarget=null;renderAdmin()};

      const add=$("#addDashboardWidget");
      if(add)add.onclick=()=>openDashboardConfig(null);
      const addTile=$("#dashboardAddTile");
      if(addTile)addTile.onclick=()=>openDashboardConfig(null);
      const resetDashboard=$("#resetDashboardTemplate");
      if(resetDashboard)resetDashboard.onclick=dashboardReset;

      $$("[data-dashboard-configure]").forEach(btn=>btn.onclick=()=>openDashboardConfig(btn.dataset.dashboardConfigure));
      $$("[data-dashboard-resize]").forEach(btn=>btn.onclick=()=>dashboardCycleSize(btn.dataset.dashboardResize));
      $$("[data-dashboard-remove]").forEach(btn=>btn.onclick=()=>dashboardRemoveWidget(btn.dataset.dashboardRemove));

      const reportSelect=$("#dashboardWidgetReport");
      if(reportSelect)reportSelect.onchange=()=>{
        const dialog=$("#dashboardConfigDialog");
        if(!dialog)return;
        const title=$("#dashboardWidgetTitle")?.value||"";
        const width=$("#dashboardWidgetWidth")?.value||"6";
        const height=$("#dashboardWidgetHeight")?.value||"standard";
        const target=dashboardConfigTarget;
        dashboardConfigTarget=target;
        const selected=reportSelect.value;
        const def=reportDefinition(selected,reportFilteredRecords());
        const chartSelect=$("#dashboardWidgetChart");
        if(chartSelect){
          chartSelect.innerHTML=reportChartOptions(def).map(([value,label])=>`<option value="${value}">${esc(label)}</option>`).join("");
        }
        if(!title&&$("#dashboardWidgetTitle"))$("#dashboardWidgetTitle").placeholder=def.title;
        if($("#dashboardWidgetWidth"))$("#dashboardWidgetWidth").value=width;
        if($("#dashboardWidgetHeight"))$("#dashboardWidgetHeight").value=height;
      };

      const saveWidget=$("#saveDashboardWidget");
      if(saveWidget)saveWidget.onclick=dashboardSaveConfig;

      $$(".dashboard-widget[draggable='true']").forEach(card=>{
        card.ondragstart=e=>{
          draggedDashboardWidgetId=card.dataset.dashboardWidget;
          card.classList.add("is-dragging");
          if(e.dataTransfer){e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",draggedDashboardWidgetId)}
        };
        card.ondragend=()=>{
          draggedDashboardWidgetId=null;
          card.classList.remove("is-dragging");
          $$(".dashboard-widget").forEach(c=>c.classList.remove("drag-over"));
        };
        card.ondragover=e=>{e.preventDefault();card.classList.add("drag-over")};
        card.ondragleave=()=>card.classList.remove("drag-over");
        card.ondrop=e=>{
          e.preventDefault();
          card.classList.remove("drag-over");
          const source=draggedDashboardWidgetId||e.dataTransfer?.getData("text/plain");
          dashboardReorder(source,card.dataset.dashboardWidget);
        };
      });
      return;
    }
    if(adminTab==="access"){
      $$("[data-access-role]").forEach(btn=>btn.onclick=()=>{accessSelectedRoleId=btn.dataset.accessRole;renderAdmin()});
      $$("[data-role-permission]").forEach(input=>input.onchange=()=>accessUpdatePermission(input.dataset.rolePermission,input.checked));

      const addRole=$("#addAccessRole");if(addRole)addRole.onclick=accessAddRole;
      const saveRole=$("#saveNewAccessRole");if(saveRole)saveRole.onclick=accessSaveNewRole;
      const renameRole=$("#renameAccessRole");if(renameRole)renameRole.onclick=accessRenameRole;
      const deleteRole=$("#deleteAccessRole");if(deleteRole)deleteRole.onclick=accessDeleteRole;

      const addMember=$("#addAccessMember");if(addMember)addMember.onclick=()=>accessOpenMemberDialog(null);
      $$("[data-edit-member]").forEach(btn=>btn.onclick=()=>accessOpenMemberDialog(btn.dataset.editMember));
      $$("[data-remove-member]").forEach(btn=>btn.onclick=()=>accessRemoveMember(btn.dataset.removeMember));
      $$("[data-member-role]").forEach(select=>select.onchange=()=>accessChangeMemberRole(select.dataset.memberRole,select.value));
      $$("[data-member-status]").forEach(select=>select.onchange=()=>accessChangeMemberStatus(select.dataset.memberStatus,select.value));
      const saveMember=$("#saveAccessMember");if(saveMember)saveMember.onclick=accessSaveMember;
      return;
    }
    if(adminTab==="notifications"){
      $$("[data-email-template]").forEach(btn=>btn.onclick=()=>{
        let settings=getEmailNotificationSettings();
        settings=updateCurrentEmailTemplateFromForm(settings);
        saveEmailNotificationSettings(settings,"");
        selectedEmailTemplateId=btn.dataset.emailTemplate;
        renderAdmin();
      });

      const save=$("#saveEmailNotifications");
      if(save)save.onclick=saveEmailNotificationForm;

      const refresh=$("#refreshEmailPreview");
      if(refresh)refresh.onclick=refreshEmailTemplatePreview;
      const clearActivity=$("#clearEmailPreviewActivity");
      if(clearActivity)clearActivity.onclick=clearEmailPreviewActivity;

      const master=$("#emailMasterEnabled");
      if(master)master.onchange=()=>{const strong=master.closest(".email-master-toggle")?.querySelector("strong");if(strong)strong.textContent=master.checked?"Enabled":"Disabled"};

      const templateEnabled=$("#emailTemplateEnabled");
      if(templateEnabled)templateEnabled.onchange=()=>{const strong=templateEnabled.closest(".email-template-switch")?.querySelector("strong");if(strong)strong.textContent=templateEnabled.checked?"Enabled":"Disabled"};

      ["#emailTemplateSubject","#emailTemplateHeadline","#emailTemplateBody","#emailTemplateCtaLabel","#emailTemplateCtaUrl","#emailSenderName","#emailFooter"].forEach(selector=>{
        const input=$(selector);if(input)input.oninput=refreshEmailTemplatePreview;
      });

      $$("[data-email-token]").forEach(btn=>btn.onclick=()=>{
        const body=$("#emailTemplateBody");
        if(!body)return;
        const token=btn.dataset.emailToken;
        const start=body.selectionStart??body.value.length;
        const end=body.selectionEnd??body.value.length;
        body.value=body.value.slice(0,start)+token+body.value.slice(end);
        body.focus();
        body.selectionStart=body.selectionEnd=start+token.length;
        refreshEmailTemplatePreview();
      });
      return;
    }
    if(adminTab==="activity"){
      const search=$("#activitySearch");
      if(search){
        search.oninput=()=>{
          activitySearch=search.value;
          clearTimeout(search._activityTimer);
          search._activityTimer=setTimeout(renderAdmin,160);
        };
      }
      const category=$("#activityCategoryFilter");
      if(category)category.onchange=()=>{activityCategoryFilter=category.value;renderAdmin()};
      const actor=$("#activityActorFilter");
      if(actor)actor.onchange=()=>{activityActorFilter=actor.value;renderAdmin()};
      const date=$("#activityDateFilter");
      if(date)date.onchange=()=>{activityDateFilter=date.value;renderAdmin()};

      const exportButton=$("#exportActivityLog");
      if(exportButton)exportButton.onclick=exportActivityLog;
      const clearButton=$("#clearLocalActivity");
      if(clearButton)clearButton.onclick=clearLocalAdminActivity;
      return;
    }
    if(adminTab==="backup"){
      const downloadBackup=$("#downloadBackupButton");
      if(downloadBackup)downloadBackup.onclick=exportJson;
      const restoreBackup=$("#restoreBackupButton");
      if(restoreBackup)restoreBackup.onclick=()=>$("#importJsonInput").click();
      return;
    }
    $$('[data-admin-path]',$("#adminPanel")).forEach(input=>input.oninput=()=>{let v=input.value;if(input.type==="number")v=v===""?null:Number(v);setDraftPath(input.dataset.adminPath,v)});
    $$('[data-division-index]',$("#adminPanel")).forEach(input=>{const fn=()=>{const d=adminDraft.divisions[Number(input.dataset.divisionIndex)];const f=input.dataset.divisionField;let v=input.type==="checkbox"?input.checked:input.value;if(input.type==="number")v=v===""?null:Number(v);d[f]=v};input.onchange=fn;if(input.type!=="checkbox")input.oninput=fn});
    $$('[data-hero-index]',$("#adminPanel")).forEach(input=>{const fn=()=>{adminDraft.heroCarousel.slides[Number(input.dataset.heroIndex)][input.dataset.heroField]=input.value};input.oninput=fn;input.onchange=fn});
    $$('[data-faq-index]',$("#adminPanel")).forEach(input=>{const fn=()=>{adminDraft.faq[Number(input.dataset.faqIndex)][input.dataset.faqField]=input.value};input.oninput=fn;input.onchange=fn});
    $$('[data-remove-division]',$("#adminPanel")).forEach(btn=>btn.onclick=()=>{adminDraft.divisions.splice(Number(btn.dataset.removeDivision),1);renderAdmin()});
    $$('[data-remove-hero]',$("#adminPanel")).forEach(btn=>btn.onclick=()=>{if(adminDraft.heroCarousel.slides.length<=1)return;adminDraft.heroCarousel.slides.splice(Number(btn.dataset.removeHero),1);renderAdmin()});
    $$('[data-remove-faq]',$("#adminPanel")).forEach(btn=>btn.onclick=()=>{adminDraft.faq.splice(Number(btn.dataset.removeFaq),1);renderAdmin()});
    const ad=$("#addDivisionButton");if(ad)ad.onclick=()=>{adminDraft.divisions.push({id:`division-${Date.now()}`,levelKey:"beginner",name:"New Division",classification:"",description:"",capacity:null,maxParticipants:null,slotsRemaining:null,fee:1800,eligibility:"DUPR-based level assignment; organizer validation applies.",enabled:false,waitlistEnabled:true});renderAdmin()};
    const ah=$("#addHeroSlideButton");if(ah)ah.onclick=()=>{if(adminDraft.heroCarousel.slides.length>=5)return;adminDraft.heroCarousel.slides.push({eyebrow:"Tournament highlight",headline:"Add your headline",body:"Add supporting copy.",image:"",imageAlt:"",imagePosition:"center",contentPosition:"center",primaryCtaLabel:"Register Now",secondaryCtaLabel:"Tournament Details",showSecondaryCta:false});renderAdmin()};
    const af=$("#addFaqButton");if(af)af.onclick=()=>{adminDraft.faq.push({q:"New question",a:"Add the organizer-approved answer here."});renderAdmin()};
  }

  function saveConfiguration(){
    if(!currentTabCanSave()){showToast("Your role cannot change this configuration");return}
    const t=adminDraft.duprEligibility?.thresholds||{};
    const low=Number(t.lowIntermediateMin),high=Number(t.highIntermediateMin),advanced=Number(t.advancedMin);
    if(![low,high,advanced].every(Number.isFinite)||!(low<high&&high<advanced)){showToast("DUPR thresholds must be numeric and strictly increasing");adminTab="dupr";renderAdmin();return}
    Object.keys(config).forEach(k=>delete config[k]);Object.assign(config,structuredClone(adminDraft));persistAdminConfig();
    const sectionLabels={details:"Event Details",divisions:"Divisions & Fees",dupr:"Level Rules",hero:"Hero Carousel",faq:"FAQ",contact:"Contact"};
    recordAdminActivity("Configuration","Saved tournament configuration",{section:sectionLabels[adminTab]||adminTab},{target:sectionLabels[adminTab]||adminTab});
    showToast("Changes saved")
  }
  function csvCell(v){const s=String(v??"").replace(/"/g,'""');return `"${s}"`}
  function exportCsv(){
    if(!can("data.export")){showToast("Your role cannot download registration data");return}
    const rows=[["Reference","Status","Division","Team Level","Category","Level Mismatch","Classification Pending","Organizer Verification","Player 1","Player 1 DOB","Player 1 Gender","Player 1 Club","Player 1 DUPR","Player 1 Requested Level","Player 1 Validated Level","Player 1 Club DUPR / Facebook Link","Player 1 Proof File","Player 1 Verification Status","Player 1 Playing Background","Player 1 Jersey","Player 2","Player 2 DOB","Player 2 Gender","Player 2 Club","Player 2 DUPR","Player 2 Requested Level","Player 2 Validated Level","Player 2 Club DUPR / Facebook Link","Player 2 Proof File","Player 2 Verification Status","Player 2 Playing Background","Player 2 Jersey","Payment Hold","Payment Method","Amount Paid","Submitted At"]];
    getRecords().filter(r=>!r.deleted).forEach(r=>{
      const e=recordEligibility(r),v1=r.verification1||{},v2=r.verification2||{};
      rows.push([
        r.reference,r.status,(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(" | "),
        e.levelKey?levelLabel(e.levelKey):e.label,e.categoryLabel||"",e.levelMismatch?"Yes":"No",e.classificationPending?"Yes":"No",e.manualReview?"Required":"Complete",
        fullName(r.player1),r.player1?.birthDate,r.player1?.gender,v1.clubAffiliation,duprText(v1),v1.requestedLevel?levelLabel(v1.requestedLevel):"",v1.organizerAssignedLevel?levelLabel(v1.organizerAssignedLevel):"",v1.verificationReference,v1.duprProofName,verificationStatusText(v1),v1.playingBackground,v1.jerseyName,
        fullName(r.player2),r.player2?.birthDate,r.player2?.gender,v2.clubAffiliation,duprText(v2),v2.requestedLevel?levelLabel(v2.requestedLevel):"",v2.organizerAssignedLevel?levelLabel(v2.organizerAssignedLevel):"",v2.verificationReference,v2.duprProofName,verificationStatusText(v2),v2.playingBackground,v2.jerseyName,
        (e.classificationPending||e.partnerPending||e.categoryPending||e.levelMismatch||!e.divisionId)?"Yes":"No",
        r.payment?.method,r.payment?.amountPaid,r.submittedAt
      ]);
    });
    download(rows.map(row=>row.map(csvCell).join(",")).join("\\n"),"animo-registrations.csv","text/csv;charset=utf-8");
    recordAdminActivity("Data","Downloaded registrations",{registrations:Math.max(0,rows.length-1)},{target:"Registration export"});
  }
  function exportJson(){
    if(!can("backup.manage")){showToast("Your role cannot manage backups");return}
    const backup={
      backupVersion:1,
      tournamentId:config.tournamentId,
      createdAt:new Date().toISOString(),
      records:getRecords(),
      configuration:structuredClone(adminDraft||config),
      dashboardLayout:dashboardWidgets(),
      accessControl:getAccessControl(),
      accessAudit:getAccessAudit(),
      emailNotifications:getEmailNotificationSettings(),
      emailActivity:getEmailActivity(),
      adminActivity:getAdminActivity()
    };
    download(JSON.stringify(backup,null,2),"animo-registration-backup.animo-backup","application/json");
    recordAdminActivity("Data","Downloaded system backup",{registrations:getRecords().filter(r=>!r.deleted).length},{target:"Backup & Restore"});
    showToast("Backup downloaded");
  }
  function download(content,name,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
  function importJson(file){
    if(!can("backup.manage")){showToast("Your role cannot restore backups");return}
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const parsed=JSON.parse(reader.result);
        let records=[];
        let restoredConfig=null;
        let restoredDashboard=null;
        let restoredAccess=null;
        let restoredAudit=null;
        let restoredEmailNotifications=null;
        let restoredEmailActivity=null;
        let restoredAdminActivity=null;

        if(Array.isArray(parsed)){
          records=parsed; // Support older registration-only backups.
        }else if(parsed&&Array.isArray(parsed.records)){
          records=parsed.records;
          restoredConfig=parsed.configuration||null;
          restoredDashboard=Array.isArray(parsed.dashboardLayout)?parsed.dashboardLayout:null;
          restoredAccess=parsed.accessControl||null;
          restoredAudit=Array.isArray(parsed.accessAudit)?parsed.accessAudit:null;
          restoredEmailNotifications=parsed.emailNotifications||null;
          restoredEmailActivity=Array.isArray(parsed.emailActivity)?parsed.emailActivity:null;
          restoredAdminActivity=Array.isArray(parsed.adminActivity)?parsed.adminActivity:null;
        }else{
          throw new Error("Backup structure not recognized");
        }

        if(!confirm("Restore this backup? This will replace the registration records and saved setup currently stored on this device."))return;

        records.forEach(reconcileRecordPlacement);
        saveRecords(records);

        if(restoredConfig&&typeof restoredConfig==="object"){
          Object.keys(config).forEach(k=>delete config[k]);
          Object.assign(config,structuredClone(restoredConfig));
          persistAdminConfig();
          adminDraft=structuredClone(config);
        }
        if(restoredDashboard){
          saveDashboardWidgets(restoredDashboard);
        }
        if(restoredAccess&&can("access.manage")){
          localStorage.setItem(ACCESS_CONTROL_KEY,JSON.stringify(normalizeAccessControl(restoredAccess)));
          if(restoredAudit)localStorage.setItem(ACCESS_AUDIT_KEY,JSON.stringify(restoredAudit.slice(0,60)));
        }
        if(restoredEmailNotifications){
          localStorage.setItem(EMAIL_NOTIFICATION_KEY,JSON.stringify(normalizeEmailNotificationSettings(restoredEmailNotifications)));
        }
        if(restoredEmailActivity){
          saveEmailActivity(restoredEmailActivity);
        }
        if(restoredAdminActivity){
          saveAdminActivity(restoredAdminActivity);
        }

        recordAdminActivity("Data","Restored system backup",{registrations:records.length},{target:file?.name||"Backup file"});
        renderAdmin();
        showToast("Backup restored");
      }catch(e){
        console.warn(e);
        showToast("This backup file could not be restored");
      }
    };
    reader.readAsText(file);
  }
  let globalUiBound=false;
  function bindGlobal(){
    if(globalUiBound)return;
    globalUiBound=true;
    $$(".admin-tab").forEach(btn=>btn.onclick=()=>{const needed=TAB_PERMISSIONS[btn.dataset.adminTab];if(needed&&!can(needed)){showToast("Your role does not have access to that section");return}adminTab=btn.dataset.adminTab;renderAdmin()});
    $("#savePublishButton").onclick=saveConfiguration;
    $("#exportCsvButton").onclick=exportCsv;
    $("#recordModalClose").onclick=()=>$("#recordModal").close();
    $("#importJsonInput").onchange=e=>{const f=e.target.files?.[0];if(f)importJson(f);e.target.value=""};
  }

  initializeAuthenticatedAdmin();
})();
