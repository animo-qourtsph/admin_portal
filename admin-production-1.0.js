(() => {
  "use strict";
  const config = window.TOURNAMENT_CONFIG;
  const SUPABASE_URL = "https://miavgvlffiloxsardwxl.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BhGGAi7yqRaKoMNaSkMm0A_G7lcgvUN";
  const EXPECTED_API_CONTRACT = "2026.09.11.1";
  const REQUIRED_SCHEMA_VERSION = "2026.09.11.1";
  let backendCompatible = false;
  let backendCheckError = "";
  let portalStateLoadedAt = 0;
  const SUPABASE_SESSION_KEY = `animo-supabase-session-${config.tournamentId}`;
  const LEGACY_RECORDS_PREFIX = `animo-registration-records-${config.tournamentId}`;
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
    {id:"registrations.reject",group:"Registration",label:"Decline or withdraw registrations",help:"Decline a registration under review or withdraw an approved registration."},

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
    trash:"data.delete",
    reports:"reports.view",
    details:"settings.event",
    divisions:"settings.divisions",
    payments:"payments.verify",
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
  const REGISTRATION_VIEW_KEY = "animo-admin-registration-view";
  let registrationView = (() => {
    try{
      const saved=localStorage.getItem(REGISTRATION_VIEW_KEY);
      return saved==="list"?"list":"cards";
    }catch{
      return "cards";
    }
  })();
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
  let liveRegistrationRecords = [];
  let liveRegistrationLoaded = false;
  let liveRegistrationLoading = false;
  let liveTrashRecords = [];
  let liveTrashLoaded = false;
  let liveTrashLoading = false;
  let trashSearchTerm = "";
  let livePaymentMethods = [];
  let livePaymentMethodsLoaded = false;
  let livePaymentMethodsLoading = false;
  let authInitializing = false;
  let activityCategoryFilter = "all";
  let activityActorFilter = "all";
  let activityDateFilter = "30";
  let activitySearch = "";
  let productionConfigVersion = 0;
  let liveEmailSettings = null;
  let liveActivityRows = [];
  let liveActivityNextBefore = null;
  let liveActivityLoading = false;
  let registrationAttentionFilter = "all";

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

  function workflowStatus(status){
    const value=String(status||"Under Review");
    if(value==="Confirmed")return "Approved";
    if(value==="Rejected")return "Declined";
    if(["Submitted","Payment Submitted","Awaiting Partner","Pending Level Validation","Pending Level Verification","Pending"].includes(value))return "Under Review";
    return value;
  }

  function statusPermission(status){
    const value=workflowStatus(status);
    if(value==="Approved")return "registrations.approve";
    if(["Declined","Withdrawn","Cancelled"].includes(value))return "registrations.reject";
    return "registrations.status";
  }

  function permittedStatusOptions(record){
    const current=workflowStatus(record?.status);
    const statuses=["Under Review","Approved","Declined","Withdrawn","Cancelled"];
    const allowed=statuses.filter(s=>can(statusPermission(s)));
    if(current&&!allowed.includes(current))allowed.unshift(current);
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

    const mobileNav=$("#adminMobileNav");
    if(mobileNav){
      [...mobileNav.options].forEach(option=>{
        const needed=TAB_PERMISSIONS[option.value];
        option.hidden=needed?!can(needed):false;
        option.disabled=needed?!can(needed):false;
      });
      mobileNav.value=adminTab;
    }

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

          const compatible=await checkBackendCompatibility();
          if(!compatible)throw new Error(backendCheckError||"Backend version mismatch.");

          await loadProductionConfig();
          await loadLivePortalState();
          await loadLiveRegistrations();
          if(can("notifications.manage"))await loadProductionEmailSettings({quiet:true});
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

    // Operational records remain server-authoritative.
    // Existing content/configuration editors keep their saved browser configuration.
    getAccessControl();
    getEmailNotificationSettings();
    loadAdminConfig();
    adminDraft=structuredClone(config);

    const restored=await restoreAdminSession();
    if(restored){
      adminTab=firstAccessibleTab();
      unlockAdmin();
      bindGlobal();

      const compatible=await checkBackendCompatibility();
      if(compatible){
        try{
          await loadLivePortalState();
          await loadLiveRegistrations({quiet:true});
        }catch(error){
          console.warn("Live Admin initialization failed:",error);
        }
      }

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
          id:"rejected",
          enabled:true,
          label:"Registration Declined",
          trigger:"When the organizer declines the registration",
          recipients:"Registration contact and affected players",
          subject:"Update on your Animo registration",
          headline:"Your registration was declined",
          body:"Hi {{player_name}},\n\nThe organizer could not approve registration {{registration_reference}} based on the information currently on file.\n\nReason: {{decision_reason}}\n\nPlease contact the tournament organizer if you need clarification.",
          ctaLabel:"View Registration Status",
          ctaUrl:"{{status_link}}",
          tone:"rejected"
        },
        {
          id:"cancelled",
          enabled:true,
          label:"Registration Withdrawn / Cancelled",
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
        if(templateId==="approved")return "Registration changed to Approved";
    if(templateId==="rejected")return "Registration changed to Declined";
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
      "Under Review":"level_validation",
      "Approved":"approved",
      "Declined":"rejected",
      "Withdrawn":"cancelled",
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
  const paymentLabel = value => {
    const key=String(value||"").trim();
    if(!key)return "—";

    const live=(livePaymentMethods||[]).find(method=>
      String(method?.id||method?.methodKey||method?.method_key||"").trim()===key
    );

    if(live?.label)return live.label;

    const configured=(config.paymentMethods||[]).find(method=>
      String(method?.id||method?.methodKey||method?.method_key||"").trim()===key
    );

    return configured?.label||key;
  };
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
  function getRecords(){
    return liveRegistrationLoaded ? liveRegistrationRecords : [];
  }

  function saveRecords(records){
    // Registration data is server-authoritative. Never persist it to localStorage.
    if(!liveRegistrationLoaded)return;
    liveRegistrationRecords=Array.isArray(records)?records:[];
  }

  function clearLegacyRegistrationCaches(){
    try{
      const remove=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key&&key.startsWith(LEGACY_RECORDS_PREFIX))remove.push(key);
      }
      remove.forEach(key=>localStorage.removeItem(key));
    }catch(error){
      console.warn("Legacy registration cache cleanup failed:",error);
    }
  }


  async function checkBackendCompatibility(){
    try{
      const response=await supabaseRequest("/functions/v1/registration-api",{
        method:"POST",
        body:{action:"health"}
      });

      const contract=String(response?.contractVersion||"");
      if(response?.schemaReady===false){
        backendCompatible=false;
        backendCheckError=`Supabase schema is not production-ready. ${Array.isArray(response?.schemaFailures)&&response.schemaFailures.length?response.schemaFailures.join(" · "):"Required migrations must be applied."}`;
        updateRegistrationDataStatus(`SCHEMA CHECK FAILED · ${backendCheckError}`,true);
        return false;
      }
      if(String(response?.schemaVersion||"")!==REQUIRED_SCHEMA_VERSION){
        backendCompatible=false;
        backendCheckError=`Database version mismatch. Expected ${REQUIRED_SCHEMA_VERSION}, received ${response?.schemaVersion||"missing"}.`;
        updateRegistrationDataStatus(`SCHEMA VERSION MISMATCH · ${backendCheckError}`,true);
        return false;
      }
      if(contract!==EXPECTED_API_CONTRACT){
        backendCompatible=false;
        backendCheckError=`Backend version mismatch. Expected ${EXPECTED_API_CONTRACT}, received ${contract||"unknown"}.`;
        updateRegistrationDataStatus(`BACKEND VERSION MISMATCH · ${backendCheckError}`,true);
        return false;
      }

      backendCompatible=true;
      backendCheckError="";
      return true;
    }catch(error){
      backendCompatible=false;
      backendCheckError=error?.message||"registration-api is unavailable.";
      updateRegistrationDataStatus(`BACKEND UNAVAILABLE · ${backendCheckError}`,true);
      return false;
    }
  }

  function applyLivePortalState(response){
    const tournament=response?.tournament||{};
    const publicConfig=response?.publicConfig||{};
    Object.entries(publicConfig).forEach(([key,value])=>{
      if(value!==undefined&&value!==null)config[key]=structuredClone(value);
    });

    if(tournament.name)config.name=tournament.name;
    if(tournament.eventDate)config.eventDate=tournament.eventDate;
    if(tournament.venue)config.venue=tournament.venue;
    config.registrationOpen=tournament.registrationOpen!==false;
    config.registrationMessage=tournament.registrationMessage||"";
    productionConfigVersion=Number(tournament.configVersion||productionConfigVersion||0);

    if(Array.isArray(response?.divisions)&&response.divisions.length){
      config.divisions=response.divisions.map(d=>({
        ...d,
        enabled:!!d.enabled,
        fee:Number.isFinite(Number(d.fee))?Number(d.fee):0,
        capacity:Number.isFinite(Number(d.capacity))?Number(d.capacity):null,
        maxParticipants:Number.isFinite(Number(d.maxParticipants))?Number(d.maxParticipants):null,
        slotsRemaining:Number.isFinite(Number(d.slotsRemaining))?Number(d.slotsRemaining):null
      }));
    }

    portalStateLoadedAt=Date.now();
    adminDraft=structuredClone(config);
  }

  async function loadLivePortalState(){
    if(!backendCompatible)throw new Error(backendCheckError||"Backend compatibility has not been confirmed.");

    const response=await supabaseRequest("/functions/v1/registration-api",{
      method:"POST",
      body:{action:"portal-state"},
      accessToken:supabaseSession?.access_token||null
    });

    if(String(response?.contractVersion||"")!==EXPECTED_API_CONTRACT){
      backendCompatible=false;
      backendCheckError="Backend contract changed while the Admin portal was open.";
      throw new Error(backendCheckError);
    }

    applyLivePortalState(response);
    return response;
  }

  async function registrationAdminApi(action,payload={},retry=true){
    if(!backendCompatible){
      throw new Error(backendCheckError||"The Admin portal is not connected to a compatible registration-api.");
    }
    await ensureFreshSupabaseSession();
    try{
      return await supabaseRequest("/functions/v1/registration-api",{
        method:"POST",
        body:{action,...payload},
        accessToken:supabaseSession.access_token
      });
    }catch(error){
      if(retry&&(error.status===401||error.status===403)){
        await refreshSupabaseSession();
        return registrationAdminApi(action,payload,false);
      }
      throw error;
    }
  }

  function updateRegistrationDataStatus(message,isError=false){
    const el=$("#registrationDataStatus");
    if(!el)return;
    el.textContent=message;
    el.style.color=isError?"#9b3b35":"";
  }

  async function loadLiveRegistrations({quiet=false}={}){
    if(liveRegistrationLoading)return;
    liveRegistrationLoading=true;
    if(!quiet)updateRegistrationDataStatus("Loading live Supabase registrations…");
    try{
      const response=await registrationAdminApi("admin-list");
      liveRegistrationRecords=Array.isArray(response?.records)?response.records:[];
      liveRegistrationLoaded=true;
      updateRegistrationDataStatus(`LIVE · ${liveRegistrationRecords.length} Supabase registration${liveRegistrationRecords.length===1?"":"s"} loaded.`);
      return liveRegistrationRecords;
    }catch(error){
      console.warn("Live registration load failed:",error);
      liveRegistrationRecords=[];
      liveRegistrationLoaded=false;
      updateRegistrationDataStatus("LIVE DATA UNAVAILABLE · Registration actions are disabled until Supabase reconnects.",true);
      if(!quiet)showToast(error?.message||"Could not load live Supabase registration data");
      throw error;
    }finally{
      liveRegistrationLoading=false;
    }
  }


  async function loadLivePaymentMethods({quiet=false}={}){
    if(livePaymentMethodsLoading)return livePaymentMethods;
    livePaymentMethodsLoading=true;
    try{
      const response=await registrationAdminApi("admin-payment-methods");
      livePaymentMethods=(Array.isArray(response?.methods)?response.methods:[]).map(m=>({...m,qrDataUrl:"",removeQr:false}));
      livePaymentMethodsLoaded=true;
      return livePaymentMethods;
    }catch(error){
      livePaymentMethods=[];
      livePaymentMethodsLoaded=false;
      if(!quiet)showToast(error?.message||"Could not load payment methods");
      throw error;
    }finally{
      livePaymentMethodsLoading=false;
    }
  }

  function paymentMethodFileToDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||""));
      reader.onerror=()=>reject(new Error("QR image could not be read."));
      reader.readAsDataURL(file);
    });
  }

  async function saveLivePaymentMethods(){
    const button=$("#savePaymentMethodsButton");
    if(button){button.disabled=true;button.textContent="Saving…"}
    try{
      const methods=livePaymentMethods.map((m,i)=>({
        id:m.id,label:String(m.label||"").trim(),enabled:!!m.enabled,
        accountName:String(m.accountName||"").trim(),
        accountNumber:String(m.accountNumber||"").trim(),
        instructions:String(m.instructions||"").trim(),
        sortOrder:Number.isFinite(Number(m.sortOrder))?Number(m.sortOrder):(i+1)*10,
        qrDataUrl:m.qrDataUrl||"",removeQr:!!m.removeQr
      }));
      const response=await registrationAdminApi("admin-payment-methods-save",{methods});
      livePaymentMethods=(Array.isArray(response?.methods)?response.methods:[]).map(m=>({...m,qrDataUrl:"",removeQr:false}));
      livePaymentMethodsLoaded=true;
      recordAdminActivity("Configuration","Updated payment methods",{enabled:livePaymentMethods.filter(m=>m.enabled).length},{target:"Payment Methods",source:"Supabase"});
      renderAdmin();
      showToast("Payment methods saved · Player portal updated");
    }catch(error){
      showToast(error?.message||"Payment methods could not be saved");
    }finally{
      if(button){button.disabled=false;button.textContent="Save Payment Methods"}
    }
  }

  function paymentMethodCard(m,i){
    const preview=m.qrDataUrl||(!m.removeQr?m.qrUrl:"");
    return `<article class="payment-method-admin-card">
      <header class="payment-method-admin-head">
        <div><span class="admin-index">${String(i+1).padStart(2,"0")}</span><strong>${esc(m.label||"Payment method")}</strong><small>${m.enabled?"Visible to players":"Hidden from players"}</small></div>
        <label class="switch-label"><input type="checkbox" data-payment-index="${i}" data-payment-field="enabled" ${m.enabled?"checked":""}/> Enabled</label>
      </header>
      <div class="payment-method-admin-grid">
        <div class="payment-method-form">
          <label class="field"><span>Display name</span><input data-payment-index="${i}" data-payment-field="label" value="${esc(m.label||"")}"/></label>
          <label class="field"><span>Account name</span><input data-payment-index="${i}" data-payment-field="accountName" value="${esc(m.accountName||"")}" placeholder="Account holder / merchant name"/></label>
          <label class="field"><span>Account number / payment ID</span><input data-payment-index="${i}" data-payment-field="accountNumber" value="${esc(m.accountNumber||"")}" placeholder="09XX..., account no., or payment ID"/></label>
          <label class="field"><span>Display order</span><input type="number" data-payment-index="${i}" data-payment-field="sortOrder" value="${esc(m.sortOrder??((i+1)*10))}"/></label>
          <label class="field full"><span>Payment instructions</span><textarea data-payment-index="${i}" data-payment-field="instructions" placeholder="Tell players how to pay and what reference to enter.">${esc(m.instructions||"")}</textarea></label>
        </div>
        <div class="payment-method-qr-panel">
          <div class="payment-method-qr-preview">${preview?`<img src="${esc(preview)}" alt="${esc(m.label||"Payment")} QR code"/>`:`<span>No QR uploaded</span>`}</div>
          <label class="button button-ghost payment-qr-upload">${preview?"Replace QR":"Upload QR"}<input type="file" accept="image/png,image/jpeg,image/webp" data-payment-qr-index="${i}" hidden/></label>
          ${preview?`<button class="text-button danger-text" type="button" data-payment-remove-qr="${i}">Remove QR</button>`:""}
          <small>PNG, JPG, or WEBP · max 5 MB</small>
        </div>
      </div>
    </article>`;
  }

  function renderAdminPaymentMethods(){
    if(livePaymentMethodsLoading){
      return `<div class="admin-panel-heading"><div><p class="eyebrow">Payment collection</p><h2>Payment Methods</h2><p>Loading live payment configuration…</p></div></div>`;
    }
    if(!livePaymentMethodsLoaded){
      setTimeout(async()=>{try{await loadLivePaymentMethods({quiet:true});if(adminTab==="payments")renderAdmin()}catch(e){}},0);
      return `<div class="admin-panel-heading"><div><p class="eyebrow">Payment collection</p><h2>Payment Methods</h2><p>Connecting to Supabase…</p></div></div>
      <div class="live-data-blocker"><strong>Loading payment methods…</strong><p>This section uses live Supabase data only.</p></div>`;
    }
    return `<div class="admin-panel-heading">
      <div><p class="eyebrow">Payment collection</p><h2>Payment Methods</h2><p>Configure exactly what players see on the Payment step.</p></div>
      <button class="button button-primary" id="savePaymentMethodsButton" type="button">Save Payment Methods</button>
    </div>
    <div class="payment-method-live-note"><strong>Live Supabase configuration</strong><span>${livePaymentMethods.filter(m=>m.enabled).length} of ${livePaymentMethods.length} methods visible to players.</span></div>
    <div class="payment-method-admin-list">${livePaymentMethods.length?livePaymentMethods.map(paymentMethodCard).join(""):`<div class="empty-state"><strong>No payment methods configured.</strong>Run the payment-method migration first.</div>`}</div>`;
  }

  function requireLiveRegistrationData(){
    if(!liveRegistrationLoaded){
      showToast("Live Supabase registration data is not loaded. Reload or reconnect before making changes.");
      return false;
    }
    return true;
  }

  function replaceLiveRecord(record){
    if(!record?.reference)return;
    const i=liveRegistrationRecords.findIndex(r=>r.reference===record.reference);
    if(i>=0)liveRegistrationRecords[i]=record;
    else liveRegistrationRecords.unshift(record);
    liveRegistrationLoaded=true;
  }

  async function loadTrashRecords({quiet=false}={}){
    if(liveTrashLoading)return liveTrashRecords;
    liveTrashLoading=true;
    try{
      const response=await registrationAdminApi("admin-list-trash");
      liveTrashRecords=Array.isArray(response?.records)?response.records:[];
      liveTrashLoaded=true;
      return liveTrashRecords;
    }catch(error){
      console.warn("Trash load failed:",error);
      if(!quiet)showToast(error?.message||"Could not load Trash");
      throw error;
    }finally{
      liveTrashLoading=false;
    }
  }

  function removeLiveRegistration(reference){
    liveRegistrationRecords=liveRegistrationRecords.filter(r=>r.reference!==reference);
  }

  function removeTrashRecord(reference){
    liveTrashRecords=liveTrashRecords.filter(r=>r.reference!==reference);
  }

  async function trashRegistration(reference){
    if(!requireLiveRegistrationData())return;
    if(!can("data.delete")){showToast("Your role cannot move registrations to Trash");return}
    if(!confirm(`Move ${reference} to Trash? You can restore it later.`))return;

    try{
      await registrationAdminApi("admin-trash",{reference});
      const record=liveRegistrationRecords.find(r=>r.reference===reference);
      removeLiveRegistration(reference);
      if(record){
        liveTrashRecords.unshift({
          ...record,
          deleted:true,
          deletedAt:new Date().toISOString(),
          trashedByEmail:supabaseAccessProfile?.email||supabaseSession?.user?.email||""
        });
      }
      liveTrashLoaded=true;
      recordAdminActivity("Registration","Moved registration to Trash",{}, {reference,target:reference,source:"Supabase"});
      const modal=$("#recordModal"); if(modal?.open)modal.close();
      renderAdmin();
      showToast("Moved to Trash");
    }catch(error){
      showToast(error?.message||"Could not move registration to Trash");
    }
  }

  async function restoreRegistration(reference){
    if(!requireLiveRegistrationData())return;
    if(!can("data.delete")){showToast("Your role cannot restore registrations");return}
    try{
      await registrationAdminApi("admin-restore",{reference});
      removeTrashRecord(reference);
      await loadLiveRegistrations({quiet:true});
      recordAdminActivity("Registration","Restored registration from Trash",{}, {reference,target:reference,source:"Supabase"});
      renderAdmin();
      showToast("Registration restored");
    }catch(error){
      showToast(error?.message||"Could not restore registration");
    }
  }

  async function permanentlyDeleteRegistration(reference){
    if(!requireLiveRegistrationData())return;
    if(!can("access.manage")){
      showToast("Permanent deletion is Director-only");
      return;
    }
    const check=prompt(`Permanent deletion cannot be undone.\n\nType DELETE ${reference} to continue:`);
    if(check!==`DELETE ${reference}`){
      if(check!==null)showToast("Permanent deletion cancelled");
      return;
    }

    try{
      await registrationAdminApi("admin-permanent-delete",{reference});
      removeTrashRecord(reference);
      recordAdminActivity("Registration","Permanently deleted registration",{}, {reference,target:reference,source:"Supabase"});
      renderAdmin();
      showToast("Registration permanently deleted");
    }catch(error){
      showToast(error?.message||"Permanent deletion failed");
    }
  }

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
    if(adminTab==="trash") panel.innerHTML=renderTrash();
    if(adminTab==="reports"){
      try{
        panel.innerHTML=renderAdminReports();
      }catch(error){
        console.error("Reports & Insights failed to render:",error);
        panel.innerHTML=`<div class="admin-panel-heading">
          <div><p class="eyebrow">Reports & insights</p><h2>Registration Intelligence</h2></div>
        </div>
        <div class="live-data-blocker">
          <strong>Reports could not be displayed.</strong>
          <p>${esc(error?.message||"An unexpected reporting error occurred.")}</p>
          <button class="button button-primary" id="retryReportsRender" type="button">Retry Reports</button>
        </div>`;
      }
    }
    if(adminTab==="details") panel.innerHTML=renderAdminDetails();
    if(adminTab==="divisions") panel.innerHTML=renderAdminDivisions();
    if(adminTab==="payments") panel.innerHTML=renderAdminPaymentMethods();
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
    const count=s=>active.filter(r=>workflowStatus(r.status)===s).length;
    return {total:active.length,review:count("Under Review"),approved:count("Approved"),declined:count("Declined"),withdrawn:count("Withdrawn")};
  }
  function registrationSearchText(r){
    const eligibility=recordEligibility(r);
    const divisions=(r.divisions||[]).map(id=>getDivision(id)?.name||id);

    return [
      r.reference,
      r.status,
      fullName(r.player1),
      fullName(r.player2),
      r.player1?.email,
      r.player2?.email,
      r.player1?.mobile,
      r.player2?.mobile,
      r.verification1?.clubAffiliation,
      r.verification2?.clubAffiliation,
      r.verification1?.jerseyName,
      r.verification2?.jerseyName,
      r.verification1?.shirtSize,
      r.verification2?.shirtSize,
      r.verification1?.duprId,
      r.verification2?.duprId,
      r.verification1?.duprRating,
      r.verification2?.duprRating,
      r.verification1?.requestedLevel,
      r.verification2?.requestedLevel,
      r.verification1?.organizerAssignedLevel,
      r.verification2?.organizerAssignedLevel,
      eligibility.label,
      eligibility.categoryLabel,
      ...divisions,
      r.payment?.method ? paymentLabel(r.payment.method) : "",
      r.payment?.status,
      r.payment?.reference,
      r.payment?.senderName,
      r.payment?.amountPaid,
      r.payment?.paymentDate
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function filteredRecords(){
    const query=String(searchTerm||"").trim().toLowerCase();
    const rows=getRecords()
      .filter(r=>!r.deleted)
      .filter(r=>statusFilter==="all"||workflowStatus(r.status)===statusFilter)
      .filter(r=>divisionFilter==="all"||(r.divisions||[]).includes(divisionFilter))
      .filter(r=>!query||registrationSearchText(r).includes(query))
      .filter(r=>{
        if(registrationAttentionFilter==="all"||registrationAttentionFilter==="oldest")return true;
        const e=recordEligibility(r),ready=approvalReadiness(r);
        if(registrationAttentionFilter==="ready")return workflowStatus(r.status)==="Under Review"&&ready.ready;
        if(registrationAttentionFilter==="level")return workflowStatus(r.status)==="Under Review"&&(e.manualReview||e.classificationPending);
        if(registrationAttentionFilter==="payment")return workflowStatus(r.status)==="Under Review"&&String(r.payment?.status||"")!=="Verified";
        if(registrationAttentionFilter==="mismatch")return !!e.levelMismatch;
        return true;
      });
    return rows.sort((a,b)=>registrationAttentionFilter==="oldest"
      ?String(a.submittedAt||"").localeCompare(String(b.submittedAt||""))
      :String(b.submittedAt||"").localeCompare(String(a.submittedAt||"")));
  }
  function renderRegistrations(){
    if(!liveRegistrationLoaded){
      return `<div class="admin-panel-heading">
        <div>
          <p class="eyebrow">Registration operations</p>
          <h2>Registration Requests</h2>
          <p>Registration data must come directly from Supabase.</p>
        </div>
      </div>
      <div class="live-data-blocker">
        <strong>Live registration data is unavailable.</strong>
        <p>No cached or preview registrations are shown. Reload the page or sign in again to reconnect to Supabase.</p>
        <button class="button button-primary" id="retryLiveRegistrations" type="button">Retry Live Connection</button>
      </div>`;
    }

    const all=getRecords();
    const s=registrationStats(all);
    const records=filteredRecords();
    const statuses=["Under Review","Approved","Declined","Withdrawn","Cancelled"];

    return `<div class="admin-panel-heading registration-heading">
      <div>
        <p class="eyebrow">Registration operations</p>
        <h2>Registration Requests</h2>
        <p>Review player details, verify level information, enforce same-level partner rules, and approve tournament entries.</p>
      </div>

      <div class="registration-view-toggle" role="group" aria-label="Registration view">
        <button
          class="registration-view-button ${registrationView==="cards"?"active":""}"
          type="button"
          data-registration-view="cards"
          aria-pressed="${registrationView==="cards"?"true":"false"}">
          <span aria-hidden="true">▦</span>
          Card View
        </button>
        <button
          class="registration-view-button ${registrationView==="list"?"active":""}"
          type="button"
          data-registration-view="list"
          aria-pressed="${registrationView==="list"?"true":"false"}">
          <span aria-hidden="true">☷</span>
          List View
        </button>
      </div>
    </div>

      <div class="admin-stat-grid">
        ${statCard("All requests",s.total)}
        ${statCard("Under review",s.review)}
        ${statCard("Approved",s.approved)}
        ${statCard("Declined",s.declined)}
        ${statCard("Withdrawn",s.withdrawn)}
      </div>

      <div class="registration-search-toolbar">
        <div class="registration-search-box">
          <span class="registration-search-icon" aria-hidden="true">⌕</span>
          <input
            id="recordSearch"
            type="search"
            autocomplete="off"
            spellcheck="false"
            value="${esc(searchTerm)}"
            placeholder="Search reference, player, email, mobile, club, jersey name, DUPR, payment..."
            aria-label="Search registrations" />
          ${searchTerm?`<button class="registration-search-clear" id="clearRecordSearch" type="button" aria-label="Clear registration search">×</button>`:""}
        </div>

        <div class="registration-search-meta">
          <strong>${records.length}</strong>
          <span>${records.length===1?"result":"results"}</span>
        </div>

        <label class="field compact-filter"><span>Status</span><select id="statusFilter"><option value="all">All statuses</option>${statuses.map(x=>`<option value="${esc(x)}" ${x===statusFilter?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
        <label class="field compact-filter"><span>Division</span><select id="divisionFilter"><option value="all">All divisions</option>${config.divisions.filter(d=>d.enabled).map(d=>`<option value="${esc(d.id)}" ${d.id===divisionFilter?"selected":""}>${esc(d.name)}</option>`).join("")}</select></label>
        <label class="field compact-filter registration-attention-filter"><span>Director queue</span><select id="attentionFilter">
          <option value="all" ${registrationAttentionFilter==="all"?"selected":""}>All registrations</option>
          <option value="ready" ${registrationAttentionFilter==="ready"?"selected":""}>Ready to approve</option>
          <option value="level" ${registrationAttentionFilter==="level"?"selected":""}>Needs level verification</option>
          <option value="payment" ${registrationAttentionFilter==="payment"?"selected":""}>Needs payment verification</option>
          <option value="mismatch" ${registrationAttentionFilter==="mismatch"?"selected":""}>Level mismatch</option>
          <option value="oldest" ${registrationAttentionFilter==="oldest"?"selected":""}>Oldest under review</option>
        </select></label>
      </div>

      ${records.length
        ? registrationView==="list"
          ? renderRegistrationList(records)
          : `<div class="registration-admin-list">${records.map(recordCard).join("")}</div>`
        : `<div class="empty-state"><strong>No registration requests found.</strong>Adjust the filters or wait for new player registrations from Supabase.</div>`}`;
  }

  function renderRegistrationList(records){
    return `<div class="registration-list-shell">
      <div class="registration-list-scroll">
        <table class="registration-list-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Players</th>
              <th>Division</th>
              <th>Level / Verification</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Submitted</th>
              <th class="registration-list-actions-head">Action</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(registrationListRow).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function submissionAgeLabel(value){
    const time=new Date(value||"").getTime();
    if(!Number.isFinite(time))return "";
    const minutes=Math.max(0,Math.floor((Date.now()-time)/60000));
    if(minutes<60)return minutes<=1?"just now":`${minutes}m ago`;
    const hours=Math.floor(minutes/60);
    if(hours<24)return `${hours}h ago`;
    return `${Math.floor(hours/24)}d ago`;
  }

  function registrationListRow(r){
    const eligibility=recordEligibility(r);
    const divs=(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(", ")||"Unassigned";
    const p1=fullName(r.player1)||"Player 1";
    const p2=r.registrationType==="pair"?(fullName(r.player2)||"Player 2"):"—";
    const verification=eligibility.levelMismatch
      ?"Level mismatch"
      : eligibility.classificationPending
      ?"Classification pending"
      : eligibility.categoryPending
      ?"Category pending"
      : eligibility.manualReview
      ?"Verification pending"
      :"Verified";
    const paymentStatus=r.payment?.status||"Submitted";
    const submitted=r.submittedAt
      ? new Date(r.submittedAt).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})
      : "—";

    return `<tr class="registration-list-row registration-list-row-clickable" data-row-reference="${esc(r.reference)}" tabindex="0" role="button" aria-label="Open registration ${esc(r.reference)}">
      <td data-label="Reference">
        <button class="registration-reference-link" type="button" data-view-record="${esc(r.reference)}">${esc(r.reference||"—")}</button>
      </td>
      <td data-label="Players">
        <div class="registration-list-players">
          <button class="registration-player-link" type="button" data-view-record="${esc(r.reference)}">${esc(p1)}</button>
          <button class="registration-player-link" type="button" data-view-record="${esc(r.reference)}">${esc(p2)}</button>
        </div>
      </td>
      <td data-label="Division"><span class="registration-list-division">${esc(divs)}</span></td>
      <td data-label="Eligibility">
        <div class="registration-list-verification">
          <strong>${esc(eligibility.label)}</strong>
          <span class="${eligibility.manualReview?"needs-review":"verified"}">${esc(verification)}</span>
        </div>
      </td>
      <td data-label="Payment">
        <span class="registration-payment-pill ${String(paymentStatus).toLowerCase()==="verified"?"verified":""}">
          ${esc(paymentStatus)}
        </span>
      </td>
      <td data-label="Status">
        <span class="status-pill workflow-status workflow-status-${workflowStatus(r.status).toLowerCase().replace(/\s+/g,"-")}">${esc(workflowStatus(r.status))}</span>
      </td>
      <td data-label="Submitted"><span class="registration-list-date">${esc(submitted)}</span></td>
      <td class="registration-list-actions" data-label="Action">
        <button class="button button-ghost registration-list-view-button" data-view-record="${esc(r.reference)}" type="button">View</button>
      </td>
    </tr>`;
  }

  function statCard(label,value){return `<article class="admin-stat-card"><span>${esc(label)}</span><strong>${Number(value).toLocaleString("en-PH")}</strong></article>`}
  function approvalReadiness(record){
    const eligibility=recordEligibility(record);
    const paymentStatus=String(record?.payment?.status||"");
    const proofAvailable=!!(record?.payment?.proofAvailable||record?.payment?.fileName);
    const missing=[];

    if(eligibility.classificationPending)missing.push("Player classification");
    if(eligibility.partnerPending)missing.push("Partner information");
    if(eligibility.categoryPending)missing.push("Doubles category");
    if(eligibility.levelMismatch)missing.push("Same-level partner rule");
    if(eligibility.manualReview)missing.push("Player level verification");
    if(!eligibility.divisionId)missing.push("Division assignment");
    if(!proofAvailable)missing.push("Payment proof");
    if(paymentStatus!=="Verified")missing.push("Payment verification");

    return {ready:missing.length===0,missing};
  }

  function workflowActionMarkup(record){
    const status=workflowStatus(record?.status);
    const readiness=approvalReadiness(record);

    if(status==="Under Review"){
      return `<div class="workflow-primary-actions">
        ${can("registrations.reject")?`<button class="button workflow-decline" data-decline-record="${esc(record.reference)}" type="button">Decline Registration</button>`:""}
        ${can("registrations.approve")?`<button class="button button-primary workflow-approve" data-approve-record="${esc(record.reference)}" type="button" ${readiness.ready?"":`disabled title="${esc(`Complete first: ${readiness.missing.join(", ")}`)}"`}>${readiness.ready?"Approve Registration":"Approval Requirements Incomplete"}</button>`:""}
      </div>`;
    }

    if(status==="Approved"){
      return `<div class="workflow-primary-actions">${can("registrations.reject")?`<button class="button workflow-withdraw" data-withdraw-record="${esc(record.reference)}" type="button">Withdraw Registration</button>`:""}</div>`;
    }

    if(["Declined","Withdrawn"].includes(status)){
      return `<div class="workflow-primary-actions">${can("registrations.status")?`<button class="button button-primary" data-reopen-record="${esc(record.reference)}" type="button">Reopen Review</button>`:""}</div>`;
    }

    return "";
  }

  function recordCard(r){
    const eligibility=recordEligibility(r);
    const divs=(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(", ")||"Unassigned";
    const player1=fullName(r.player1)||"Player 1";
    const player2=r.registrationType==="pair"?(fullName(r.player2)||"Player 2"):"—";
    const paymentStatus=r.payment?.status||"Submitted";
    const paymentVerified=String(paymentStatus).toLowerCase()==="verified";

    const verificationLabel=eligibility.levelMismatch
      ?"Level mismatch"
      : eligibility.classificationPending
      ?"Classification pending"
      : eligibility.categoryPending
      ?"Category pending"
      : eligibility.manualReview
      ?"Verification required"
      :"Verified";

    const needsAction=
      eligibility.levelMismatch||
      eligibility.classificationPending||
      eligibility.categoryPending||
      eligibility.manualReview||
      !paymentVerified;

    const submitted=r.submittedAt
      ? new Date(r.submittedAt).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})
      : "Date unavailable";

    return `<article
      class="registration-admin-card director-registration-card ${needsAction?"director-card-needs-action":"director-card-ready"}"
      data-card-reference="${esc(r.reference)}"
      tabindex="0"
      role="button"
      aria-label="Open registration ${esc(r.reference)}">

      <div class="director-card-header">
        <div class="director-card-ident">
          <div class="director-card-badges">
            <span class="status-pill">${esc(workflowStatus(r.status))}</span>
            ${workflowStatus(r.status)==="Under Review"
              ? (needsAction
                  ? `<span class="director-action-pill">Checks incomplete</span>`
                  : `<span class="director-ready-pill">Ready to decide</span>`)
              : workflowStatus(r.status)==="Approved"
                ? `<span class="director-ready-pill">Official</span>`
                : `<span class="director-action-pill">${esc(workflowStatus(r.status))}</span>`}
          </div>
          <button class="director-reference-link" data-view-record="${esc(r.reference)}" type="button">${esc(r.reference||"No reference")}</button>
        </div>

        <div class="director-card-controls">
          <button class="button button-ghost" data-view-record="${esc(r.reference)}" type="button">View Record</button>
        </div>
      </div>

      <div class="director-card-body">
        <section class="director-team-block" aria-label="Registered players">
          <p class="director-card-label">Players</p>
          <div class="director-player-pair">
            <div class="director-player">
              <span>Player 1</span>
              <strong>${esc(player1)}</strong>
            </div>
            <div class="director-player-divider" aria-hidden="true">+</div>
            <div class="director-player">
              <span>Player 2</span>
              <strong>${esc(player2)}</strong>
            </div>
          </div>
        </section>

        <div class="director-decision-grid">
          <div class="director-decision-item">
            <span>Division</span>
            <strong>${esc(divs)}</strong>
          </div>

          <div class="director-decision-item ${eligibility.manualReview||eligibility.levelMismatch?"decision-warning":"decision-good"}">
            <span>Eligibility</span>
            <strong>${esc(verificationLabel)}</strong>
            <small>${esc(eligibility.label)}${eligibility.categoryLabel?` · ${esc(eligibility.categoryLabel)}`:""}</small>
          </div>

          <div class="director-decision-item ${paymentVerified?"decision-good":"decision-warning"}">
            <span>Payment</span>
            <strong>${esc(paymentVerified?"Verified":paymentStatus)}</strong>
            <small>${esc(r.payment?.method?paymentLabel(r.payment.method):"No verified payment yet")}</small>
          </div>

          <div class="director-decision-item">
            <span>Submitted</span>
            <strong>${esc(submitted)}</strong>
            <small>${esc(submissionAgeLabel(r.submittedAt))}</small>
          </div>
        </div>
      </div>
    </article>`;
  }

  function filteredTrashRecords(){
    return [...liveTrashRecords].filter(r=>{
      if(!trashSearchTerm)return true;
      const hay=[
        r.reference,
        fullName(r.player1),
        fullName(r.player2),
        r.player1?.email,
        r.player2?.email,
        r.trashedByEmail,
        r.trashNote
      ].join(" ").toLowerCase();
      return hay.includes(trashSearchTerm.toLowerCase());
    }).sort((a,b)=>String(b.deletedAt||"").localeCompare(String(a.deletedAt||"")));
  }

  function renderTrash(){
    if(!liveTrashLoaded&&!liveTrashLoading){
      setTimeout(async()=>{
        try{
          await loadTrashRecords({quiet:true});
          if(adminTab==="trash")renderAdmin();
        }catch(e){}
      },0);
    }
    const records=filteredTrashRecords();
    return `<div class="admin-panel-heading">
      <div>
        <p class="eyebrow">Registration operations</p>
        <h2>Trash / Recycle Bin</h2>
        <p>Restore registrations moved here by mistake. Permanent deletion is available to Directors only.</p>
      </div>
      <span class="status-pill">${liveTrashRecords.length} in Trash</span>
    </div>

    <div class="admin-filter-bar trash-filter-bar">
      <label class="field"><span>Search Trash</span><input id="trashSearch" value="${esc(trashSearchTerm)}" placeholder="Name, reference, email" /></label>
    </div>

    <div class="trash-admin-list">
      ${records.length?records.map(trashRecordCard).join(""):`<div class="empty-state"><strong>Trash is empty.</strong>Registrations moved to Trash will appear here and can be restored.</div>`}
    </div>`;
  }

  function trashRecordCard(r){
    const divs=(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(", ")||"No division assigned";
    const deletedDate=r.deletedAt?new Date(r.deletedAt).toLocaleString("en-PH"):"Date unavailable";
    const actor=r.trashedByEmail||"Organizer";
    return `<article class="registration-admin-card trash-record-card">
      <div class="registration-admin-main">
        <div class="registration-admin-title"><span class="status-pill trash-pill">Trashed</span><strong>${esc(r.reference||"No reference")}</strong></div>
        <h3>${esc(fullName(r.player1))}</h3>
        <p>${esc(fullName(r.player2)||"Partner")} · ${esc(divs)}</p>
        <small>Moved to Trash ${esc(deletedDate)} · ${esc(actor)}</small>
        ${r.trashNote?`<small class="trash-note">${esc(r.trashNote)}</small>`:""}
      </div>
      <div class="registration-admin-actions trash-actions">
        <button class="button button-ghost" data-restore-record="${esc(r.reference)}" type="button">Restore</button>
        ${can("access.manage")?`<button class="button button-ghost danger-text" data-permanent-delete-record="${esc(r.reference)}" type="button">Delete Permanently</button>`:""}
      </div>
    </article>`;
  }


  async function openPrivateProof(reference,proofType,playerSlot=null){
    let popup=null;

    try{
      popup=window.open("about:blank","_blank");
      if(popup){
        try{
          popup.document.title="Opening proof…";
          popup.document.body.innerHTML='<div style="font-family:Arial,sans-serif;padding:24px;color:#173229">Opening proof…</div>';
        }catch(e){}
      }

      const payload={reference,proofType};
      if(proofType==="dupr")payload.playerSlot=Number(playerSlot);

      const response=await registrationAdminApi("admin-proof-url",payload);
      if(!response?.url)throw new Error("Proof URL was not returned.");

      if(popup)popup.location.replace(response.url);
      else window.location.href=response.url;
    }catch(error){
      if(popup&&!popup.closed)popup.close();
      console.warn("Proof viewer failed:",error);
      showToast(error?.message||"Proof could not be opened");
    }
  }

  function duprProofMarkup(reference,slot,v){
    if(v?.hasDupr!=="Yes")return "";

    if(v?.duprProofAvailable||v?.duprProofName){
      return `<button class="admin-proof-open-card" type="button"
        data-open-proof="dupr"
        data-proof-record="${esc(reference)}"
        data-proof-slot="${slot}">
        <span class="proof-open-icon" aria-hidden="true">↗</span>
        <span class="proof-open-copy">
          <strong>DUPR proof</strong>
          <small>${esc(v?.duprProofStatus||"Submitted")} · Click or tap to open</small>
        </span>
        <span class="proof-open-action">View</span>
      </button>`;
    }

    return `<div class="admin-warning-box"><strong>DUPR proof: Missing</strong><p>No DUPR screenshot was provided.</p></div>`;
  }


  function paymentVerificationMarkup(reference,payment){
    const hasProof=!!(payment?.proofAvailable||payment?.fileName);
    const verified=String(payment?.status||"").toLowerCase()==="verified";

    if(!hasProof){
      return `<div class="payment-verification-state payment-verification-missing">
        <strong>Payment cannot be verified</strong>
        <span>Proof of payment is missing.</span>
      </div>`;
    }

    if(verified){
      return `<div class="payment-verification-state payment-verification-ok">
        <strong>✓ Payment Verified</strong>
        <span>The live Supabase payment record is marked Verified.</span>
      </div>`;
    }

    if(!can("payments.verify")){
      return `<div class="payment-verification-state">
        <strong>Payment awaiting verification</strong>
        <span>Your role can view payment information but cannot verify it.</span>
      </div>`;
    }

    return `<button class="button button-verify-payment" data-verify-payment="${esc(reference)}" type="button">
      Verify Payment
    </button>`;
  }

  async function liveVerifyPayment(reference){
    if(!requireLiveRegistrationData())return;
    if(!can("payments.verify")){
      showToast("Your role cannot verify payments");
      return;
    }

    const record=liveRegistrationRecords.find(r=>r.reference===reference);
    if(!record)return;

    if(!(record.payment?.proofAvailable||record.payment?.fileName)){
      showToast("Payment proof is missing");
      return;
    }

    if(!confirm(`Verify the payment for ${reference}?\\n\\nUse the uploaded proof and payment details as your basis.`))return;

    try{
      const response=await registrationAdminApi("admin-payment-verify",{reference});
      await loadLiveRegistrations({quiet:true});
      renderAdmin();

      const refreshed=liveRegistrationRecords.find(r=>r.reference===reference);
      if(refreshed)openRecord(reference);

      showToast(response?.changed===false?"Payment was already verified":"Payment verified in Supabase");
    }catch(error){
      console.warn("Payment verification failed:",error);
      showToast(error?.message||"Payment could not be verified");
    }
  }

  function paymentProofMarkup(reference,payment){
    if(!(payment?.proofAvailable||payment?.fileName)){
      return `<div class="admin-warning-box"><strong>Payment proof: Missing</strong><p>No payment proof was uploaded.</p></div>`;
    }

    return `<button class="admin-proof-open-card payment-proof-open-card" type="button"
      data-open-proof="payment"
      data-proof-record="${esc(reference)}">
      <span class="proof-open-icon" aria-hidden="true">↗</span>
      <span class="proof-open-copy">
        <strong>Proof of payment</strong>
        <small>Click or tap to open</small>
      </span>
      <span class="proof-open-action">View</span>
    </button>`;
  }

  function verificationStatusText(v){
    if(v?.hasDupr==="Yes")return v?.duprProofStatus||"Pending Verification";
    if(v?.hasDupr==="No")return v?.organizerAssignedLevel&&v?.manualLevelApproved?`Validated ${levelLabel(v.organizerAssignedLevel)}`:v?.requestedLevel?`Requested ${levelLabel(v.requestedLevel)} · Pending validation`:"Requested level missing";
    return "Incomplete";
  }
  function verificationActions(reference,slot,v){
    const actions=[];
    const playerSlot=slot==="verification2"?2:1;

    if(v?.hasDupr==="Yes"){
      if(can("eligibility.verify")&&v?.duprProofStatus!=="Verified"){
        actions.push(`<button class="button button-ghost" data-live-verify-dupr="${playerSlot}" data-record="${esc(reference)}" type="button">Verify DUPR</button>`);
      }
      if(can("eligibility.verify")){
        actions.push(`<button class="button button-ghost" data-live-request-proof="${playerSlot}" data-record="${esc(reference)}" type="button">Request New Proof</button>`);
      }
      if(can("eligibility.reclassify")){
        actions.push(`<button class="button button-ghost" data-live-correct-dupr="${playerSlot}" data-record="${esc(reference)}" type="button">Correct Rating</button>`);
      }
    }

    if(v?.hasDupr==="No"){
      if(can("eligibility.verify")&&!v?.manualLevelApproved){
        actions.push(`<button class="button button-primary" data-live-verify-level="${playerSlot}" data-record="${esc(reference)}" type="button">Verify Requested Level</button>`);
      }

      if(can("eligibility.reclassify")){
        actions.push(`<button class="button button-ghost" data-live-change-level="${playerSlot}" data-record="${esc(reference)}" type="button">${v?.manualLevelApproved?"Change Validated Level":"Set Different Level"}</button>`);
      }
    }

    return actions.length?`<div class="verification-actions">${actions.join("")}</div>`:"";
  }
  function findRegistrationRecord(reference){
    const key=String(reference||"").trim().toUpperCase();
    if(!key)return null;

    return getRecords().find(record=>
      String(record?.reference||"").trim().toUpperCase()===key
    )||null;
  }

  function openRecord(reference){
    const r=findRegistrationRecord(reference);
    if(!r){
      console.warn("Registration record not found:",reference);
      showToast("Registration record could not be opened. Refresh the live registrations and try again.");
      return;
    }

    try{
      const eligibility=recordEligibility(r);
    const divs=(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(", ")||"Pending";
    const paymentStatus=r.payment?.status||"Submitted";
    const paymentVerified=String(paymentStatus).toLowerCase()==="verified";
    const currentWorkflowStatus=workflowStatus(r.status);
    const readiness=approvalReadiness(r);

    const playerBlock=(label,p,v,slot)=>{
      const playerSlot=slot==="verification1"?1:2;
      const assigned=v?.hasDupr==="No"
        ? (v?.organizerAssignedLevel?levelLabel(v.organizerAssignedLevel):"Not yet validated")
        : "—";

      const noDuprSupport=v?.hasDupr==="No"
        ? `<div class="record-support-grid">
            <div class="admin-note-block">
              <span>Club DUPR / Facebook page</span>
              <p>${v?.verificationReference?`<a href="${esc(v.verificationReference)}" target="_blank" rel="noopener">${esc(v.verificationReference)}</a>`:"—"}</p>
            </div>
            <div class="admin-note-block">
              <span>Playing background & recent tournament history</span>
              <p>${esc(v?.playingBackground||"—")}</p>
            </div>
          </div>`
        : "";

      return `<section class="record-detail-section player-record-card">
        <div class="record-section-title">
          <div>
            <p class="eyebrow">${esc(label)}</p>
            <h3>${esc(fullName(p))}</h3>
          </div>
          <span class="record-player-status">${esc(verificationStatusText(v))}</span>
        </div>

        <div class="record-detail-grid player-detail-grid">
          ${detail("Date of birth",p?.birthDate)}
          ${detail("Gender",p?.gender)}
          ${detail("Email",p?.email)}
          ${detail("Mobile",p?.mobile)}
          ${detail("Club affiliation",v?.clubAffiliation)}
          ${detail("Jersey back name",v?.jerseyName)}
          ${detail("Shirt size",v?.shirtSize)}
          ${detail("DUPR status",v?.hasDupr||"—")}
          ${detail("DUPR profile / ID",v?.duprId)}
          ${detail("DUPR rating",v?.duprRating?Number(v.duprRating).toFixed(2):v?.hasDupr==="No"?"No rating":"—")}
          ${v?.hasDupr==="No"?detail("Requested level",v?.requestedLevel?levelLabel(v.requestedLevel):"—"):""}
          ${detail("Organizer-validated level",assigned)}
          ${detail("System / provisional level",playerLevel(v))}
        </div>

        ${noDuprSupport}
        ${duprProofMarkup(reference,playerSlot,v)}
        ${verificationActions(reference,slot,v)}
      </section>`;
    };

    const issue=eligibility.levelMismatch
      ? `<div class="admin-warning-box"><strong>Partner level mismatch</strong><p>Player 1 and Player 2 are not classified in the same tournament level. Do not approve until this is resolved.</p></div>`
      : eligibility.classificationPending
      ? `<div class="admin-warning-box"><strong>Level information incomplete</strong><p>At least one player is missing the level information required to determine the team division.</p></div>`
      : eligibility.categoryPending
      ? `<div class="admin-warning-box"><strong>Category verification required</strong><p>A legacy or incomplete record does not contain Male/Female values for both players. Complete the gender data before approval.</p>${can("eligibility.reclassify")?`<button class="button button-ghost" data-set-category="${esc(reference)}" type="button">Assign Category</button>`:""}</div>`
      : eligibility.manualReview
      ? `<div class="admin-warning-box"><strong>Validation still required</strong><p>Every player must be explicitly verified before approval. Verify DUPR screenshots, or review the club reference and playing history for no-DUPR players.</p></div>`
      : `<div class="record-ready-box"><strong>✓ Player eligibility complete</strong><span>Same-level rule is satisfied and the division is resolved.</span></div>`;

    const paymentHeld=eligibility.classificationPending||eligibility.partnerPending||eligibility.categoryPending||eligibility.levelMismatch||!eligibility.divisionId;

    $("#recordModalBody").innerHTML=`
      <div class="record-modal-shell">
        <header class="record-modal-top">
          <div class="record-modal-heading">
            <div>
              <p class="eyebrow">Registration record</p>
              <h2>${esc(r.reference||"Registration")}</h2>
              <p>${esc(fullName(r.player1))}${r.registrationType==="pair"?` + ${esc(fullName(r.player2))}`:""} · ${esc(divs)}</p>
            </div>
            <span class="status-pill">${esc(currentWorkflowStatus)}</span>
          </div>

          <div class="record-summary-strip">
            <div><span>Team level</span><strong>${esc(eligibility.levelKey?levelLabel(eligibility.levelKey):eligibility.label)}</strong></div>
            <div><span>Category</span><strong>${esc(eligibility.categoryLabel||"Pending")}</strong></div>
            <div><span>Division</span><strong>${esc(divs)}</strong></div>
            <div class="${paymentVerified?"summary-good":""}"><span>Payment</span><strong>${esc(paymentVerified?"Verified":paymentStatus||"Submitted")}</strong></div>
          </div>
        </header>

        <div class="record-modal-scroll">
          <section class="record-detail-section eligibility-record-section">
            <div class="record-section-title">
              <div><p class="eyebrow">Eligibility</p><h3>Level & division verification</h3></div>
              <span class="record-player-status">${esc(eligibility.manualReview?"Action required":"Complete")}</span>
            </div>
            <div class="record-detail-grid overview-detail-grid">
              ${detail("Team level",eligibility.levelKey?levelLabel(eligibility.levelKey):eligibility.label)}
              ${detail("Category",eligibility.categoryLabel||"Pending")}
              ${detail("Assigned division",divs)}
              ${detail("Same-level rule",eligibility.levelMismatch?"Failed":eligibility.classificationPending?"Pending":"Satisfied")}
              ${detail("Organizer verification",eligibility.manualReview?"Required":"Complete")}
              ${detail("Payment availability",paymentHeld?"On hold":"Available")}
            </div>
            ${issue}
          </section>

          <div class="record-player-grid">
            ${playerBlock("Player 1",r.player1,r.verification1,"verification1")}
            ${r.registrationType==="pair"?playerBlock("Player 2",r.player2,r.verification2,"verification2"):""}
          </div>

          <section class="record-detail-section payment-record-section">
            <div class="record-section-title">
              <div><p class="eyebrow">Payment</p><h3>Payment review</h3></div>
              <span class="record-player-status ${paymentVerified?"record-status-good":""}">${esc(paymentVerified?"Verified":paymentStatus||"Submitted")}</span>
            </div>

            <div class="record-payment-layout">
              <div>
                <div class="record-detail-grid payment-detail-grid">
                  ${detail("Payment status",paymentStatus||"Submitted")}
                  ${detail("Method",r.payment?.method?paymentLabel(r.payment.method):"—")}
                  ${detail("Expected",r.payment?.amountDue!==""&&r.payment?.amountDue!=null?formatMoney(r.payment.amountDue):formatMoney(reportExpectedFee(r)))}
                  ${detail("Submitted amount",r.payment?.amountPaid!==""&&r.payment?.amountPaid!=null?formatMoney(r.payment.amountPaid):"—")}
                  ${detail("Difference",formatMoney((Number(r.payment?.amountPaid)||0)-(Number(r.payment?.amountDue)||reportExpectedFee(r))))}
                  ${detail("Reference",r.payment?.reference)}
                  ${detail("Sender",r.payment?.senderName)}
                  ${detail("Payment date",r.payment?.paymentDate)}
                  ${detail("Verified by",r.payment?.verifiedByEmail||"—")}
                  ${detail("Verified at",r.payment?.verifiedAt?new Date(r.payment.verifiedAt).toLocaleString("en-PH"):"—")}
                </div>

                ${["Withdrawn","Cancelled"].includes(currentWorkflowStatus)?`
                  <div class="payment-resolution-card">
                    <span class="eyebrow">Payment resolution</span>
                    <h4>Resolve the verified payment</h4>
                    <div class="payment-resolution-grid">
                      <label class="field"><span>Resolution</span><select id="paymentResolutionStatus">
                        ${["None","Refund Pending","Refunded","Retained","Waived"].map(value=>`<option value="${value}" ${value===(r.payment?.resolutionStatus||"None")?"selected":""}>${value}</option>`).join("")}
                      </select></label>
                      <label class="field"><span>Resolution amount</span><input id="paymentResolutionAmount" type="number" min="0" step="0.01" value="${esc(r.payment?.resolutionAmount??"")}"/></label>
                      <label class="field full"><span>Note</span><textarea id="paymentResolutionNote" rows="3">${esc(r.payment?.resolutionNote||"")}</textarea></label>
                    </div>
                    <button class="button button-ghost" id="savePaymentResolution" type="button">Save Payment Resolution</button>
                  </div>`:""}
              </div>

              <div class="payment-review-panel">
                ${paymentProofMarkup(r.reference,r.payment)}
                ${paymentVerificationMarkup(r.reference,r.payment)}
              </div>
            </div>
          </section>
        </div>

        ${currentWorkflowStatus==="Under Review"?`
          <section class="approval-readiness ${readiness.ready?"is-ready":"needs-work"}">
            <div>
              <span class="eyebrow">Approval readiness</span>
              <strong>${readiness.ready?"Ready to approve":"Complete the required checks first"}</strong>
              <p>${readiness.ready
                ?"Both players are verified, the division is resolved, and payment is verified."
                :`Missing: ${esc(readiness.missing.join(" · "))}`}</p>
            </div>
          </section>`:""}

        <footer class="record-modal-actions workflow-footer">
          <div class="record-modal-danger-actions">
            ${can("data.delete")?`<details class="workflow-more">
              <summary>More</summary>
              <div class="workflow-more-menu">
                <button class="workflow-menu-item danger-text" data-trash-record="${esc(r.reference)}" type="button">Move to Trash</button>
              </div>
            </details>`:""}
          </div>
          <div class="record-modal-status-actions">
            ${workflowActionMarkup(r)}
          </div>
        </footer>
      </div>`;

    const modal=$("#recordModal");
    modal.showModal();

    $$("[data-open-proof]",modal).forEach(btn=>btn.onclick=()=>openPrivateProof(
      btn.dataset.proofRecord,
      btn.dataset.openProof,
      btn.dataset.proofSlot||null
    ));

    const verifyPayment=$("[data-verify-payment]",modal);
    if(verifyPayment)verifyPayment.onclick=()=>liveVerifyPayment(r.reference);

    const saveResolution=$("#savePaymentResolution",modal);
    if(saveResolution)saveResolution.onclick=async()=>{
      saveResolution.disabled=true;
      try{
        await registrationAdminApi("admin-payment-resolution",{
          reference:r.reference,
          resolutionStatus:$("#paymentResolutionStatus",modal)?.value||"None",
          resolutionAmount:$("#paymentResolutionAmount",modal)?.value??"",
          resolutionNote:$("#paymentResolutionNote",modal)?.value||""
        });
        await loadLiveRegistrations({quiet:true});
        openRecord(r.reference);
        showToast("Payment resolution saved");
      }catch(error){
        showToast(error?.message||"Payment resolution could not be saved");
      }finally{
        saveResolution.disabled=false;
      }
    };

    const trashButton=$("[data-trash-record]",modal);
    if(trashButton)trashButton.onclick=()=>trashRegistration(r.reference);

    const declineBtn=$("[data-decline-record]",modal);
    if(declineBtn)declineBtn.onclick=()=>declineRegistration(r.reference);

    const approveBtn=$("[data-approve-record]",modal);
    if(approveBtn)approveBtn.onclick=()=>approveRegistration(r.reference);

    const withdrawBtn=$("[data-withdraw-record]",modal);
    if(withdrawBtn)withdrawBtn.onclick=()=>withdrawRegistration(r.reference);

    const reopenBtn=$("[data-reopen-record]",modal);
    if(reopenBtn)reopenBtn.onclick=()=>reopenRegistration(r.reference);

    $$("[data-live-verify-dupr]",modal).forEach(btn=>btn.onclick=async()=>liveVerifyPlayer(r.reference,Number(btn.dataset.liveVerifyDupr),"verify-dupr"));
    $$("[data-live-request-proof]",modal).forEach(btn=>btn.onclick=async()=>liveVerifyPlayer(r.reference,Number(btn.dataset.liveRequestProof),"request-dupr-proof"));
    $$("[data-live-correct-dupr]",modal).forEach(btn=>btn.onclick=async()=>liveCorrectDupr(r.reference,Number(btn.dataset.liveCorrectDupr)));
    $$("[data-live-verify-level]",modal).forEach(btn=>btn.onclick=async()=>liveVerifyNoDuprLevel(r.reference,Number(btn.dataset.liveVerifyLevel)));
    $$("[data-live-change-level]",modal).forEach(btn=>btn.onclick=async()=>liveChangeNoDuprLevel(r.reference,Number(btn.dataset.liveChangeLevel)));

    const cat=$("[data-set-category]",modal);
    if(cat)cat.onclick=()=>assignCategory(r.reference);
    }catch(error){
      console.error("Registration record modal failed:",error,r);
      showToast("This registration could not be displayed. The error was logged in the browser console.");
    }
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
  async function liveVerifyPlayer(reference,playerSlot,verificationAction,payload={}){
    if(!requireLiveRegistrationData())return;

    try{
      const response=await registrationAdminApi("admin-player-verification",{
        reference,
        playerSlot,
        verificationAction,
        ...payload
      });

      await loadLiveRegistrations({quiet:true});
      renderAdmin();

      const record=liveRegistrationRecords.find(r=>r.reference===reference);
      if(record)openRecord(reference);

      if(response?.synchronization?.mismatch){
        showToast("Player verified · partner level mismatch still needs resolution");
      }else{
        showToast(response?.actionLabel||"Player verification saved");
      }
    }catch(error){
      console.warn("Player verification failed:",error);
      showToast(error?.message||"Player verification could not be saved");
    }
  }

  async function liveVerifyNoDuprLevel(reference,playerSlot){
    const record=liveRegistrationRecords.find(r=>r.reference===reference);
    if(!record)return;
    const v=playerSlot===2?record.verification2:record.verification1;

    if(!v?.requestedLevel){
      showToast("This player does not have a requested level");
      return;
    }

    const label=levelLabel(v.requestedLevel);
    if(!confirm(`Verify Player ${playerSlot} at ${label}?\\n\\nUse the club reference and playing history shown in the record as your basis.`))return;

    await liveVerifyPlayer(reference,playerSlot,"verify-no-dupr-level");
  }

  async function liveChangeNoDuprLevel(reference,playerSlot){
    if(!can("eligibility.reclassify")){
      showToast("Your role cannot reclassify players");
      return;
    }

    const record=liveRegistrationRecords.find(r=>r.reference===reference);
    if(!record)return;
    const v=playerSlot===2?record.verification2:record.verification1;
    const current=v?.organizerAssignedLevel||v?.requestedLevel||"beginner";

    const raw=prompt(
      "Set validated tournament level: beginner, lowIntermediate, highIntermediate, or advanced",
      current
    );
    if(raw===null)return;

    const aliases={
      beginner:"beginner",
      lowintermediate:"lowIntermediate",
      "low intermediate":"lowIntermediate",
      highintermediate:"highIntermediate",
      "high intermediate":"highIntermediate",
      advanced:"advanced"
    };
    const key=aliases[String(raw).trim().toLowerCase()];
    if(!key){
      showToast("Level was not recognized");
      return;
    }

    await liveVerifyPlayer(reference,playerSlot,"set-no-dupr-level",{level:key});
  }

  async function liveCorrectDupr(reference,playerSlot){
    if(!can("eligibility.reclassify")){
      showToast("Your role cannot reclassify players");
      return;
    }

    const record=liveRegistrationRecords.find(r=>r.reference===reference);
    if(!record)return;
    const v=playerSlot===2?record.verification2:record.verification1;
    const raw=prompt("Enter the DUPR rating shown in the uploaded screenshot:",v?.duprRating||"");
    if(raw===null)return;

    const rating=Number(raw);
    if(!Number.isFinite(rating)||rating<=0||rating>8){
      showToast("Enter a valid DUPR rating");
      return;
    }

    await liveVerifyPlayer(reference,playerSlot,"correct-dupr",{duprRating:rating});
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
  function workflowReason(action){
    const raw=prompt(action==="withdraw"
      ?"Reason for withdrawing this approved registration:\\n\\nThis reason will be recorded and included in the player notification email."
      :"Reason for declining this registration:\\n\\nThis reason will be recorded and included in the player notification email.");
    if(raw===null)return null;
    const reason=String(raw).trim();
    if(!reason){
      showToast(`A reason is required to ${action==="withdraw"?"withdraw":"decline"} a registration`);
      return null;
    }
    return reason;
  }

  async function declineRegistration(reference){
    const reason=workflowReason("decline");
    if(!reason)return;
    if(!confirm(`Decline registration ${reference}?\\n\\nThe players will be notified.`))return;
    return updateStatus(reference,"Declined",{reason,reopenModal:true});
  }

  async function approveRegistration(reference){
    const record=findRegistrationRecord(reference);
    if(!record)return;
    const readiness=approvalReadiness(record);
    if(!readiness.ready){
      showToast(`Approval blocked · ${readiness.missing.join(", ")}`);
      return;
    }
    if(!confirm(`Approve registration ${reference}?\\n\\nThis makes the team officially accepted for the tournament.`))return;
    return updateStatus(reference,"Approved",{reopenModal:true});
  }

  async function withdrawRegistration(reference){
    const reason=workflowReason("withdraw");
    if(!reason)return;
    if(!confirm(`Withdraw approved registration ${reference}?\\n\\nThe team will be removed from the active tournament roster and its division slot will be released.`))return;
    return updateStatus(reference,"Withdrawn",{reason,reopenModal:true});
  }

  async function reopenRegistration(reference){
    if(!confirm(`Reopen registration ${reference} for review?`))return;
    return updateStatus(reference,"Under Review",{reopenModal:true});
  }

  async function updateStatus(reference,status,options={}){
    if(!requireLiveRegistrationData())return;
    if(!can(statusPermission(status))){showToast("Your role cannot make that status change");return}

    const record=liveRegistrationRecords.find(r=>r.reference===reference);
    if(!record){
      showToast("This registration is not present in the live Supabase list.");
      return;
    }

    const oldStatus=workflowStatus(record.status);
    if(oldStatus===status)return;

    let reason=String(options?.reason||"").trim();
    if(["Declined","Withdrawn"].includes(status)&&!reason){
      showToast("A reason is required for this action");
      return;
    }

    const controls=$$(`[data-status-record="${CSS.escape(reference)}"]`);
    controls.forEach(control=>control.disabled=true);
    showToast(`Updating ${reference} in Supabase…`);

    try{
      const response=await registrationAdminApi("admin-update-status",{
        reference,
        status,
        reason:reason||undefined
      });

      // Re-read the server after every mutation. Do not trust a browser copy.
      await loadLiveRegistrations({quiet:true});

      const email=response?.email||{};
      recordAdminActivity("Registration","Changed live registration status",{
        from:oldStatus||"—",
        to:status,
        automaticEmails:Number(email.sent||0),
        failedEmails:Number(email.failed||0),
        suppressedEmails:Number(email.suppressed||0),
        reason:reason||""
      },{reference,target:reference,source:"Supabase"});

      renderAdmin();

      if(options?.reopenModal){
        requestAnimationFrame(()=>{
          const refreshed=findRegistrationRecord(reference);
          if(refreshed)openRecord(reference);
        });
      }

      if(Number(email.sent||0)>0){
        showToast(`${status} saved in Supabase · ${email.sent} email${email.sent===1?"":"s"} sent`);
      }else if(Number(email.failed||0)>0){
        showToast(`${status} saved in Supabase · email delivery failed`);
      }else if(Number(email.suppressed||0)>0){
        showToast(`${status} saved in Supabase · email notification is disabled`);
      }else{
        showToast(`${status} saved in Supabase · no email trigger for this status`);
      }
    }catch(error){
      console.warn("Live status update failed:",error);
      try{await loadLiveRegistrations({quiet:true})}catch(e){}
      renderAdmin();
      showToast(error?.message||"Status was not changed in Supabase");
    }finally{
      controls.forEach(control=>control.disabled=false);
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
      if(reportStatus!=="all"&&workflowStatus(r.status)!==reportStatus)return false;
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
    const approved=records.filter(r=>workflowStatus(r.status)==="Approved").length;
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
      approved,
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
      const rows=reportGroup(records,r=>workflowStatus(r.status));
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
          workflowStatus(r.status)
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
      const active=records.filter(r=>!["Declined","Withdrawn","Cancelled"].includes(workflowStatus(r.status)));
      const expected=active.reduce((s,r)=>s+reportExpectedFee(r),0);
      const verified=records.filter(r=>String(r.payment?.status||"")==="Verified").reduce((s,r)=>s+(Number(r.payment?.amountPaid)||0),0);
      const awaiting=active.filter(r=>String(r.payment?.status||"")!=="Verified").reduce((s,r)=>s+(Number(r.payment?.amountPaid)||0),0);
      const rows=[
        {label:"Expected active fees",value:expected},
        {label:"Verified collected",value:verified},
        {label:"Submitted / awaiting verification",value:awaiting},
        {label:"Active balance remaining",value:Math.max(expected-verified,0)}
      ];
      return reportSimple("Finance reconciliation","Separates active expected fees, verified collections, and submitted payments still awaiting organizer verification.",rows,"bar","Amount","currency");
    }
    if(key==="capacity"){
      const enabled=(config.divisions||[]).filter(d=>d.enabled);
      const tableRows=enabled.map(d=>{
        const registered=records.filter(r=>(r.divisions||[]).includes(d.id)&&!["Declined","Withdrawn","Cancelled"].includes(workflowStatus(r.status))).length;
        const capacity=Number(d.capacity)||0;
        const remaining=capacity?Math.max(capacity-registered,0):null;
        const utilization=capacity?Math.round(registered/capacity*100):null;
        return [d.name,registered,capacity||"—",remaining??"—",utilization==null?"—":`${utilization}%`];
      });
      const rows=enabled.map(d=>{
        const registered=records.filter(r=>(r.divisions||[]).includes(d.id)&&!["Declined","Withdrawn","Cancelled"].includes(workflowStatus(r.status))).length;
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
        p.jersey||"—",p.verification?.shirtSize||"—",p.name,p.record.reference||"—",
        (p.record.divisions||[]).map(id=>getDivision(id)?.name||id).join(" | ")||"Pending",
        p.club
      ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
      return {
        title:"Jersey production list",
        description:"Production-ready jersey list with the back name and shirt size together.",
        defaultChart:"table",
        tableOnly:true,
        tableHeaders:["Jersey back name","Shirt size","Player","Registration","Division","Club"],
        tableRows:rows
      };
    }
    if(key==="detail"){
      const rows=records.map(r=>{
        const e=recordEligibility(r), v1=r.verification1||{}, v2=r.verification2||{};
        return [
          r.reference||"—",workflowStatus(r.status),
          fullName(r.player1),r.registrationType==="pair"?fullName(r.player2):"—",
          (r.divisions||[]).map(id=>getDivision(id)?.name||id).join(" | ")||"Pending",
          e.levelKey?levelLabel(e.levelKey):e.label||"Pending",
          e.categoryLabel||"Pending",
          e.manualReview?"Needs validation":"Ready",
          v1.clubAffiliation||"—",v2.clubAffiliation||"—",
          v1.jerseyName||"—",v2.jerseyName||"—",
          v1.shirtSize||"—",v2.shirtSize||"—",
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
        tableHeaders:["Reference","Status","Player 1","Player 2","Division","Level","Category","Verification","Player 1 Club","Player 2 Club","Player 1 Jersey Back Name","Player 2 Jersey Back Name","Player 1 Shirt Size","Player 2 Shirt Size","Payment Method","Amount Paid","Submitted"],
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
    const statuses=["Under Review","Approved","Declined","Withdrawn","Cancelled"];
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
    const approvedPct=kpis.registrations?Math.round(kpis.approved/kpis.registrations*100):0;
    return `<div class="bi-insight-grid">
      <article><span>Most requested division</span><strong>${esc(topDivision?.label||"No data yet")}</strong><small>${topDivision?`${topDivision.value} registration${topDivision.value===1?"":"s"}`:"Registrations will populate this insight."}</small></article>
      <article><span>Fairness review</span><strong>${kpis.needsReview.toLocaleString("en-PH")} need attention</strong><small>${noDupr.toLocaleString("en-PH")} no-DUPR player${noDupr===1?"":"s"} · ${pendingProof.toLocaleString("en-PH")} DUPR proof${pendingProof===1?"":"s"} pending</small></article>
      <article><span>Approval progress</span><strong>${approvedPct}% approved</strong><small>${kpis.approved.toLocaleString("en-PH")} of ${kpis.registrations.toLocaleString("en-PH")} filtered registrations</small></article>
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
        <div class="bi-table-export-actions">
          <button class="button button-ghost" id="downloadCurrentReportCsv" type="button" ${rows.length?"":"disabled"}>Export CSV</button>
          <button class="button button-ghost" id="downloadCurrentReportExcel" type="button" ${rows.length?"":"disabled"}>Export Excel</button>
        </div>
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
          <button class="button button-ghost" id="exportRegistrationCsvButton" type="button">Export Registration CSV</button>
          <button class="button button-primary" id="exportRegistrationExcelButton" type="button">Export Registration Excel</button>
          <button class="button button-ghost" id="printReportButton" type="button">Print / Save PDF</button>
        </div>
      </div>

      <div class="bi-kpi-grid">
        ${reportKpiCard("Registration requests",k.registrations.toLocaleString("en-PH"),"Filtered active records")}
        ${reportKpiCard("Known players",k.players.toLocaleString("en-PH"),"Player profiles in the filtered data")}
        ${reportKpiCard("Approved entries",k.approved.toLocaleString("en-PH"),"Officially accepted tournament registrations")}
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

  function reportFileSlug(title){
    return String(title||"report").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"report";
  }

  function exportReportCsv(def,fileName){
    const headers=def?.tableHeaders||[];
    const rows=def?.tableRows||[];
    if(!rows.length){showToast("There is no report data to export");return}
    const csv=[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\n");
    download(csv,fileName||`animo-${reportFileSlug(def.title)}.csv`,"text/csv;charset=utf-8");
    showToast("CSV exported");
  }

  function xmlEscape(value){
    return String(value??"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&apos;");
  }

  function xlsxColumnName(index){
    let n=index+1, out="";
    while(n>0){
      const rem=(n-1)%26;
      out=String.fromCharCode(65+rem)+out;
      n=Math.floor((n-1)/26);
    }
    return out;
  }

  function xlsxCrc32(bytes){
    let crc=0xFFFFFFFF;
    for(let i=0;i<bytes.length;i++){
      crc^=bytes[i];
      for(let j=0;j<8;j++){
        crc=(crc>>>1)^((crc&1)?0xEDB88320:0);
      }
    }
    return (crc^0xFFFFFFFF)>>>0;
  }

  function xlsxU16(value){
    const n=value>>>0;
    return [n&255,(n>>>8)&255];
  }

  function xlsxU32(value){
    const n=value>>>0;
    return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  }

  function xlsxConcat(parts){
    const total=parts.reduce((sum,p)=>sum+p.length,0);
    const out=new Uint8Array(total);
    let offset=0;
    parts.forEach(part=>{out.set(part,offset);offset+=part.length});
    return out;
  }

  function xlsxZipStore(files){
    const encoder=new TextEncoder();
    const now=new Date();
    const dosTime=((now.getHours()&31)<<11)|((now.getMinutes()&63)<<5)|((Math.floor(now.getSeconds()/2))&31);
    const dosDate=(((Math.max(1980,now.getFullYear())-1980)&127)<<9)|(((now.getMonth()+1)&15)<<5)|(now.getDate()&31);

    const localParts=[];
    const centralParts=[];
    let localOffset=0;

    files.forEach(file=>{
      const nameBytes=encoder.encode(file.name);
      const dataBytes=typeof file.data==="string"?encoder.encode(file.data):file.data;
      const crc=xlsxCrc32(dataBytes);
      const flags=0x0800;

      const localHeader=Uint8Array.from([
        ...xlsxU32(0x04034b50),
        ...xlsxU16(20),
        ...xlsxU16(flags),
        ...xlsxU16(0),
        ...xlsxU16(dosTime),
        ...xlsxU16(dosDate),
        ...xlsxU32(crc),
        ...xlsxU32(dataBytes.length),
        ...xlsxU32(dataBytes.length),
        ...xlsxU16(nameBytes.length),
        ...xlsxU16(0)
      ]);

      localParts.push(localHeader,nameBytes,dataBytes);

      const centralHeader=Uint8Array.from([
        ...xlsxU32(0x02014b50),
        ...xlsxU16(20),
        ...xlsxU16(20),
        ...xlsxU16(flags),
        ...xlsxU16(0),
        ...xlsxU16(dosTime),
        ...xlsxU16(dosDate),
        ...xlsxU32(crc),
        ...xlsxU32(dataBytes.length),
        ...xlsxU32(dataBytes.length),
        ...xlsxU16(nameBytes.length),
        ...xlsxU16(0),
        ...xlsxU16(0),
        ...xlsxU16(0),
        ...xlsxU16(0),
        ...xlsxU32(0),
        ...xlsxU32(localOffset)
      ]);

      centralParts.push(centralHeader,nameBytes);
      localOffset+=localHeader.length+nameBytes.length+dataBytes.length;
    });

    const local=xlsxConcat(localParts);
    const central=xlsxConcat(centralParts);

    const end=Uint8Array.from([
      ...xlsxU32(0x06054b50),
      ...xlsxU16(0),
      ...xlsxU16(0),
      ...xlsxU16(files.length),
      ...xlsxU16(files.length),
      ...xlsxU32(central.length),
      ...xlsxU32(local.length),
      ...xlsxU16(0)
    ]);

    return new Blob([local,central,end],{
      type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  function buildXlsxBlob(headers,rows,sheetName="Registrations"){
    const all=[headers,...rows];
    const safeSheet=String(sheetName||"Registrations")
      .replace(/[\\/*?:\[\]]/g," ")
      .trim()
      .slice(0,31)||"Registrations";

    const widths=headers.map((_,col)=>{
      const maxLen=Math.max(
        String(headers[col]??"").length,
        ...rows.slice(0,500).map(row=>String(row?.[col]??"").length)
      );
      return Math.min(42,Math.max(10,maxLen+2));
    });

    const cols=widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join("");

    const sheetRows=all.map((row,rowIndex)=>{
      const cells=row.map((value,colIndex)=>{
        const ref=`${xlsxColumnName(colIndex)}${rowIndex+1}`;
        const style=rowIndex===0?' s="1"':"";
        const text=xmlEscape(value??"");
        return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${text}</t></is></c>`;
      }).join("");
      return `<row r="${rowIndex+1}">${cells}</row>`;
    }).join("");

    const lastCol=xlsxColumnName(Math.max(0,headers.length-1));
    const lastRow=Math.max(1,all.length);

    const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(safeSheet)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

    const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font/><font><b/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

    const worksheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;

    return xlsxZipStore([
      {name:"[Content_Types].xml",data:contentTypes},
      {name:"_rels/.rels",data:rootRels},
      {name:"xl/workbook.xml",data:workbook},
      {name:"xl/_rels/workbook.xml.rels",data:workbookRels},
      {name:"xl/styles.xml",data:styles},
      {name:"xl/worksheets/sheet1.xml",data:worksheet}
    ]);
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function exportReportExcel(def,fileName){
    const headers=def?.tableHeaders||[];
    const rows=def?.tableRows||[];
    if(!rows.length){showToast("There is no report data to export");return}
    const blob=buildXlsxBlob(headers,rows,def.title||"Registrations");
    downloadBlob(blob,fileName||`animo-${reportFileSlug(def.title)}.xlsx`);
    showToast("Excel workbook exported");
  }

  function exportCurrentReportCsv(){
    const def=reportDefinition(reportKey,reportFilteredRecords());
    exportReportCsv(def);
  }

  function exportCurrentReportExcel(){
    const def=reportDefinition(reportKey,reportFilteredRecords());
    exportReportExcel(def);
  }

  function exportRegistrationReportCsv(){
    const def=reportDefinition("detail",reportFilteredRecords());
    exportReportCsv(def,"animo-registration-report.csv");
  }

  function exportRegistrationReportExcel(){
    const def=reportDefinition("detail",reportFilteredRecords());
    exportReportExcel(def,"animo-registration-report.xlsx");
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
        <div><span class="eyebrow">Role assignments</span><h3>Team Members</h3><p>Maintain the intended organizer role blueprint. Actual sign-in permissions remain enforced by Supabase.</p></div>
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
      <div class="access-section-head"><div><span class="eyebrow">Accountability</span><h3>Recent Access Changes</h3><p>Shows recent server-recorded access and configuration activity when available.</p></div></div>
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
      ["2","Under Review","Review"],
      ["3","Approved","Official"]
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
        <span>Try approving, declining, or withdrawing a registration. The corresponding Player 1 / Player 2 email events will appear here automatically.</span>
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
          <p>Manage the live emails players receive as their registration moves through review and approval.</p>
        </div>
        <div class="email-page-actions">
          <button class="button button-primary" id="saveEmailNotifications" type="button">Save Notification Settings</button>
        </div>
      </div>

      <div class="email-preview-mode-note">
        <div class="email-preview-mode-icon">!</div>
        <div>
          <strong>Live email delivery — Gmail SMTP connected</strong>
          <span>Status changes made from Registration Requests are saved to Supabase first, then the matching Player 1 / Player 2 email notification is sent through qourtsph@gmail.com when that template is enabled.</span>
        </div>
        <span class="email-connection-badge">Connected</span>
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
          <p>When an authorized organizer changes a relevant registration status, the matching email notification is triggered automatically. For example: <strong>Approved → Registration Approved email → Player 1 + Player 2.</strong></p>
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
          <div><span class="eyebrow">Automatic trigger log</span><h3>Email Activity</h3><p>Registration status changes now create live Supabase email events and Gmail delivery attempts. The local activity shown here remains a convenience view until the Email Activity table is fully switched to server history.</p></div>
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
      const retry=$("#retryLiveRegistrations");
      if(retry)retry.onclick=async()=>{
        try{
          if(!backendCompatible){
            const compatible=await checkBackendCompatibility();
            if(!compatible)throw new Error(backendCheckError);
          }
          await loadLivePortalState();
          await loadLiveRegistrations();
          renderAdmin();
        }catch(e){}
      };
      if(!liveRegistrationLoaded)return;
      $$("[data-registration-view]").forEach(btn=>btn.onclick=()=>{
        registrationView=btn.dataset.registrationView==="list"?"list":"cards";
        try{localStorage.setItem(REGISTRATION_VIEW_KEY,registrationView)}catch(e){}
        renderAdmin();
      });
      const s=$("#recordSearch");
      if(s){
        let searchTimer=null;

        const applySearch=()=>{
          searchTerm=s.value;
          renderAdmin();

          requestAnimationFrame(()=>{
            const next=$("#recordSearch");
            if(next){
              next.focus({preventScroll:true});
              const end=next.value.length;
              try{next.setSelectionRange(end,end)}catch(e){}
            }
          });
        };

        s.oninput=()=>{
          if(searchTimer)clearTimeout(searchTimer);
          searchTimer=setTimeout(applySearch,120);
        };

        s.onkeydown=e=>{
          if(e.key==="Escape"){
            e.preventDefault();
            searchTerm="";
            renderAdmin();
          }
        };
      }

      const clearSearch=$("#clearRecordSearch");
      if(clearSearch)clearSearch.onclick=()=>{
        searchTerm="";
        renderAdmin();
        requestAnimationFrame(()=>{
          const next=$("#recordSearch");
          if(next)next.focus({preventScroll:true});
        });
      };
      const sf=$("#statusFilter"); if(sf)sf.onchange=()=>{statusFilter=sf.value;renderAdmin()};
      const df=$("#divisionFilter"); if(df)df.onchange=()=>{divisionFilter=df.value;renderAdmin()};
      const af=$("#attentionFilter"); if(af)af.onchange=()=>{registrationAttentionFilter=af.value;renderAdmin()};
      $$('[data-view-record]').forEach(control=>control.onclick=event=>{
        event.preventDefault();
        event.stopPropagation();
        openRecord(control.dataset.viewRecord);
      });

      $$("[data-card-reference]").forEach(card=>{
        const openCard=event=>{
          if(event?.target?.closest("button,select,input,a,label"))return;
          openRecord(card.dataset.cardReference);
        };

        card.onclick=openCard;
        card.onkeydown=event=>{
          if(event.key!=="Enter"&&event.key!==" ")return;
          if(event.target?.closest("button,select,input,a,label"))return;
          event.preventDefault();
          openRecord(card.dataset.cardReference);
        };
      });

      $$("[data-row-reference]").forEach(row=>{
        const openRow=event=>{
          if(event?.target?.closest("button,select,input,a,label"))return;
          openRecord(row.dataset.rowReference);
        };

        row.onclick=openRow;
        row.onkeydown=event=>{
          if(event.key!=="Enter"&&event.key!==" ")return;
          if(event.target?.closest("button,select,input,a,label"))return;
          event.preventDefault();
          openRecord(row.dataset.rowReference);
        };
      });

      return;
    }
    if(adminTab==="trash"){
      const s=$("#trashSearch"); if(s)s.oninput=()=>{trashSearchTerm=s.value;renderAdmin()};
      $$("[data-restore-record]").forEach(btn=>btn.onclick=()=>restoreRegistration(btn.dataset.restoreRecord));
      $$("[data-permanent-delete-record]").forEach(btn=>btn.onclick=()=>permanentlyDeleteRegistration(btn.dataset.permanentDeleteRecord));
      return;
    }
    if(adminTab==="reports"){
      const retryReports=$("#retryReportsRender");
      if(retryReports)retryReports.onclick=()=>renderAdmin();

      const rk=$("#reportKey"); if(rk)rk.onchange=()=>{reportKey=rk.value;reportChartType="auto";renderAdmin()};
      const ct=$("#reportChartType"); if(ct)ct.onchange=()=>{reportChartType=ct.value;renderAdmin()};
      const dw=$("#reportDateWindow"); if(dw)dw.onchange=()=>{reportDateWindow=dw.value;renderAdmin()};
      const rs=$("#reportStatus"); if(rs)rs.onchange=()=>{reportStatus=rs.value;renderAdmin()};
      const rd=$("#reportDivision"); if(rd)rd.onchange=()=>{reportDivision=rd.value;renderAdmin()};
      const rl=$("#reportLevel"); if(rl)rl.onchange=()=>{reportLevel=rl.value;renderAdmin()};
      const rc=$("#reportCategory"); if(rc)rc.onchange=()=>{reportCategory=rc.value;renderAdmin()};
      const reset=$("#resetReportFilters"); if(reset)reset.onclick=()=>{reportStatus="all";reportDivision="all";reportLevel="all";reportCategory="all";reportDateWindow="all";renderAdmin()};
      const downloadReportCsv=$("#downloadCurrentReportCsv"); if(downloadReportCsv)downloadReportCsv.onclick=exportCurrentReportCsv;
      const downloadReportExcel=$("#downloadCurrentReportExcel"); if(downloadReportExcel)downloadReportExcel.onclick=exportCurrentReportExcel;
      const exportRegistrationCsv=$("#exportRegistrationCsvButton"); if(exportRegistrationCsv)exportRegistrationCsv.onclick=exportRegistrationReportCsv;
      const exportRegistrationExcel=$("#exportRegistrationExcelButton"); if(exportRegistrationExcel)exportRegistrationExcel.onclick=exportRegistrationReportExcel;
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
    if(adminTab==="payments"){
      const save=$("#savePaymentMethodsButton");if(save)save.onclick=saveLivePaymentMethods;

      $$("[data-payment-index]").forEach(input=>{
        const apply=()=>{
          const m=livePaymentMethods[Number(input.dataset.paymentIndex)];
          if(!m)return;
          const field=input.dataset.paymentField;
          let value=input.type==="checkbox"?input.checked:input.value;
          if(input.type==="number")value=value===""?0:Number(value);
          m[field]=value;
        };
        input.onchange=apply;
        if(input.type!=="checkbox")input.oninput=apply;
      });

      $$("[data-payment-qr-index]").forEach(input=>input.onchange=async()=>{
        const m=livePaymentMethods[Number(input.dataset.paymentQrIndex)];
        const file=input.files?.[0];
        if(!m||!file)return;
        if(!["image/png","image/jpeg","image/webp"].includes(file.type)){showToast("QR must be PNG, JPG, or WEBP");return}
        if(file.size>5*1024*1024){showToast("QR image must be 5 MB or smaller");return}
        m.qrDataUrl=await paymentMethodFileToDataUrl(file);
        m.removeQr=false;
        renderAdmin();
      });

      $$("[data-payment-remove-qr]").forEach(btn=>btn.onclick=()=>{
        const m=livePaymentMethods[Number(btn.dataset.paymentRemoveQr)];
        if(!m)return;
        m.qrDataUrl="";m.qrUrl="";m.removeQr=true;renderAdmin();
      });
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
      const refresh=$("#refreshActivityLog");
      if(refresh)refresh.onclick=async()=>{await loadProductionActivity({reset:true});renderAdmin()};
      const more=$("#loadMoreActivity");
      if(more)more.onclick=async()=>{await loadProductionActivity({reset:false});renderAdmin()};
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
      if(downloadBackup)downloadBackup.onclick=downloadProductionBackup;
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
    const rows=[["Reference","Status","Division","Team Level","Category","Level Mismatch","Classification Pending","Organizer Verification","Player 1","Player 1 DOB","Player 1 Gender","Player 1 Club","Player 1 DUPR","Player 1 Requested Level","Player 1 Validated Level","Player 1 Club DUPR / Facebook Link","Player 1 Proof File","Player 1 Verification Status","Player 1 Playing Background","Player 1 Jersey Back Name","Player 1 Shirt Size","Player 2","Player 2 DOB","Player 2 Gender","Player 2 Club","Player 2 DUPR","Player 2 Requested Level","Player 2 Validated Level","Player 2 Club DUPR / Facebook Link","Player 2 Proof File","Player 2 Verification Status","Player 2 Playing Background","Player 2 Jersey Back Name","Player 2 Shirt Size","Payment Hold","Payment Method","Amount Paid","Submitted At"]];
    getRecords().filter(r=>!r.deleted).forEach(r=>{
      const e=recordEligibility(r),v1=r.verification1||{},v2=r.verification2||{};
      rows.push([
        r.reference,r.status,(r.divisions||[]).map(id=>getDivision(id)?.name||id).join(" | "),
        e.levelKey?levelLabel(e.levelKey):e.label,e.categoryLabel||"",e.levelMismatch?"Yes":"No",e.classificationPending?"Yes":"No",e.manualReview?"Required":"Complete",
        fullName(r.player1),r.player1?.birthDate,r.player1?.gender,v1.clubAffiliation,duprText(v1),v1.requestedLevel?levelLabel(v1.requestedLevel):"",v1.organizerAssignedLevel?levelLabel(v1.organizerAssignedLevel):"",v1.verificationReference,v1.duprProofName,verificationStatusText(v1),v1.playingBackground,v1.jerseyName,v1.shirtSize,
        fullName(r.player2),r.player2?.birthDate,r.player2?.gender,v2.clubAffiliation,duprText(v2),v2.requestedLevel?levelLabel(v2.requestedLevel):"",v2.organizerAssignedLevel?levelLabel(v2.organizerAssignedLevel):"",v2.verificationReference,v2.duprProofName,verificationStatusText(v2),v2.playingBackground,v2.jerseyName,v2.shirtSize,
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

  // =========================================================
  // PRODUCTION 1.0 — server-authoritative settings & activity
  // =========================================================

  function divisionCategoryKey(division){
    const raw=String(division?.categoryKey||division?.category||division?.id||division?.name||"").toLowerCase();
    if(raw.includes("mixed"))return "mixed";
    if(raw.includes("women")||raw.includes("womens")||raw.includes("female"))return "women";
    return "men";
  }

  function normalizeAdminDivision(row){
    const levelMap={beginner:"beginner",low_intermediate:"lowIntermediate",high_intermediate:"highIntermediate",advanced:"advanced"};
    const categoryMap={mens:"men",womens:"women",mixed:"mixed"};
    const levelKey=levelMap[row?.level_key]||row?.levelKey||"beginner";
    const categoryKey=categoryMap[row?.category]||divisionCategoryKey(row);
    const fee=Number(row?.fee ?? config.divisions?.[0]?.fee ?? 1800);
    const capacity=Number(row?.team_capacity ?? row?.capacity ?? 0);
    return {
      id:row?.code||row?.id,
      code:row?.code||row?.id,
      levelKey,
      categoryKey,
      name:row?.name||"Untitled division",
      classification:`${levelLabel(levelKey)} · ${categoryKey==="mixed"?"Mixed":categoryKey==="women"?"Women's":"Men's"}`,
      description:`${categoryKey==="mixed"?"Mixed":categoryKey==="women"?"Women's":"Men's"} Doubles · ${levelLabel(levelKey)}`,
      eligibility:"Tournament level rules and organizer validation apply.",
      capacity,
      maxParticipants:capacity?capacity*2:null,
      slotsRemaining:row?.slotsRemaining ?? null,
      fee,
      enabled:row?.is_enabled ?? row?.enabled ?? true,
      waitlistEnabled:false
    };
  }

  async function loadProductionConfig(){
    const response=await registrationAdminApi("admin-config");
    const saved=response?.config&&typeof response.config==="object"?response.config:{};

    Object.entries(saved).forEach(([key,value])=>{
      if(value!==undefined&&value!==null)config[key]=structuredClone(value);
    });

    const tournament=response?.tournament||{};
    if(tournament.name)config.name=tournament.name;
    if(tournament.eventDate)config.eventDate=tournament.eventDate;
    if(tournament.venue)config.venue=tournament.venue;

    const fee=Number(tournament.feePerPlayer);
    if(Array.isArray(response?.divisions)&&response.divisions.length){
      config.divisions=response.divisions.map(row=>normalizeAdminDivision({...row,fee:Number.isFinite(fee)?fee:1800}));
    }

    productionConfigVersion=Number(response?.configVersion||0);
    adminDraft=structuredClone(config);
    if(saved?.accessControl)adminDraft.accessControl=normalizeAccessControl(saved.accessControl);
    return response;
  }

  function loadAdminConfig(){
    // Browser-local tournament configuration is intentionally ignored in Production 1.0.
    return false;
  }

  function persistAdminConfig(){
    // Production configuration is persisted through registration-api -> Supabase.
    return false;
  }

  function getAccessControl(){
    return normalizeAccessControl(adminDraft?.accessControl||config?.accessControl||defaultAccessControl());
  }

  function saveAccessControl(access,action="",details={}){
    const normalized=normalizeAccessControl(access);
    if(adminDraft)adminDraft.accessControl=structuredClone(normalized);
    config.accessControl=structuredClone(normalized);

    registrationAdminApi("admin-config-save",{
      section:"access",
      config:{accessControl:normalized}
    }).then(response=>{
      productionConfigVersion=Number(response?.configVersion||productionConfigVersion);
    }).catch(error=>{
      console.warn("Access policy save failed:",error);
      showToast(error?.message||"Access policy could not be saved");
    });

    return normalized;
  }

  function getAccessAudit(){
    return liveActivityRows
      .filter(row=>String(row.category||"").toLowerCase().includes("access"))
      .slice(0,30)
      .map(row=>({at:row.at,action:row.action,actor:row.actorName||row.actorEmail||"Organizer"}));
  }

  async function loadProductionEmailSettings({quiet=false}={}){
    try{
      const response=await registrationAdminApi("admin-email-settings");
      const defaults=defaultEmailNotificationSettings();
      const rows=Array.isArray(response?.templates)?response.templates:[];
      const byKey=new Map(rows.map(row=>[row.template_key,row]));

      const templates=defaults.templates
        .filter(item=>item.id!=="partner_invitation")
        .map(item=>{
          const row=byKey.get(item.id);
          return row?{
            ...item,
            enabled:row.enabled!==false,
            subject:row.subject||item.subject,
            headline:row.headline||item.headline,
            body:row.body||item.body,
            ctaLabel:row.cta_label||item.ctaLabel,
            ctaUrl:row.cta_url||item.ctaUrl
          }:item;
        });

      liveEmailSettings=normalizeEmailNotificationSettings({
        ...defaults,
        enabled:templates.some(t=>t.enabled),
        senderName:response?.senderName||defaults.senderName,
        replyTo:response?.replyTo||defaults.replyTo,
        templates
      });
      liveEmailSettings.emailConfigured=response?.emailConfigured===true;
      return liveEmailSettings;
    }catch(error){
      if(!quiet)showToast(error?.message||"Email settings could not be loaded");
      throw error;
    }
  }

  function getEmailNotificationSettings(){
    return liveEmailSettings||normalizeEmailNotificationSettings(defaultEmailNotificationSettings());
  }

  function saveEmailNotificationSettings(settings){
    liveEmailSettings=normalizeEmailNotificationSettings(settings);
    return liveEmailSettings;
  }

  async function saveEmailNotificationForm(){
    if(!can("notifications.manage")){showToast("Your role cannot manage email notifications");return}
    let settings=getEmailNotificationSettings();
    settings=updateCurrentEmailTemplateFromForm(settings);

    const master=$("#emailMasterEnabled");
    if(master&&!master.checked)settings.templates.forEach(template=>template.enabled=false);

    const button=$("#saveEmailNotifications");
    if(button){button.disabled=true;button.textContent="Saving…"}
    try{
      await registrationAdminApi("admin-email-settings-save",{
        templates:settings.templates.map(template=>({
          template_key:template.id,
          enabled:!!template.enabled,
          subject:template.subject,
          headline:template.headline,
          body:template.body,
          cta_label:template.ctaLabel,
          cta_url:template.ctaUrl
        }))
      });
      await loadProductionEmailSettings({quiet:true});
      await loadProductionActivity({reset:true,quiet:true});
      renderAdmin();
      showToast("Live email templates saved");
    }catch(error){
      showToast(error?.message||"Email templates could not be saved");
    }finally{
      if(button){button.disabled=false;button.textContent="Save Notification Settings"}
    }
  }

  async function loadProductionActivity({reset=false,quiet=false}={}){
    if(liveActivityLoading)return liveActivityRows;
    liveActivityLoading=true;
    try{
      const response=await registrationAdminApi("admin-activity",{
        limit:50,
        before:reset?"":(liveActivityNextBefore||"")
      });
      const rows=Array.isArray(response?.rows)?response.rows:[];
      liveActivityRows=reset?rows:[...liveActivityRows,...rows];
      liveActivityNextBefore=response?.nextBefore||null;
      return liveActivityRows;
    }catch(error){
      if(!quiet)showToast(error?.message||"Activity log could not be loaded");
      throw error;
    }finally{
      liveActivityLoading=false;
    }
  }

  function recordAdminActivity(){ return null; }
  function getAdminActivity(){ return []; }
  function saveAdminActivity(){ return false; }
  function mappedAccessActivity(){ return []; }
  function mappedEmailActivity(){ return []; }

  function allActivityRows(){
    return liveActivityRows.map(row=>({
      ...row,
      details:typeof row.details==="string"?row.details:activityDetailText(row.details)
    }));
  }

  function getEmailActivity(){
    return liveActivityRows
      .filter(row=>row.category==="Email")
      .map(row=>({
        id:row.id,
        at:row.at,
        reference:row.reference||"",
        templateId:row.action||"",
        templateLabel:String(row.action||"Notification").replace(/_/g," "),
        recipientName:row.target||"Player",
        recipientEmail:row.details?.recipient_email||"",
        result:row.result||"Completed",
        detail:row.details?.error||"",
        source:row.details?.trigger||row.source||"Automatic workflow",
        preview:false
      }));
  }

  function saveEmailActivity(){ return false; }
  function clearEmailPreviewActivity(){
    showToast("Permanent Supabase email history cannot be cleared from this browser");
  }
  function clearLocalAdminActivity(){
    showToast("Permanent Supabase audit history cannot be cleared from this browser");
  }

  function registrationConfigReadiness(){
    const missing=[];
    const opening=String(adminDraft?.registrationOpening||"").trim();
    const deadline=String(adminDraft?.registrationDeadline||"").trim();
    const waiverVersion=String(adminDraft?.waiver?.version||"").trim();
    const waiverText=String(adminDraft?.waiver?.fullText||"").trim();
    if(!opening||placeholder(opening))missing.push("registration opening date");
    if(!deadline||placeholder(deadline))missing.push("registration deadline");
    if(!waiverVersion||placeholder(waiverVersion))missing.push("waiver version");
    if(!waiverText||placeholder(waiverText))missing.push("full waiver text");
    return {ready:missing.length===0,missing};
  }


  // =========================================================
  // PRODUCTION 1.0 — live configuration/admin surfaces
  // =========================================================

  function renderAdminDetails(){
    const ready=registrationConfigReadiness();
    return `<div class="admin-panel-heading">
      <div>
        <p class="eyebrow">Event configuration · Supabase live</p>
        <h2>Core tournament details</h2>
        <p>These values publish to the Player portal. Registration intentionally fails closed until the opening/deadline dates and organizer-approved waiver are complete.</p>
      </div>
      <span class="status-pill ${ready.ready?"production-ready":"production-blocked"}">${ready.ready?"Registration configuration ready":"Registration gate closed"}</span>
    </div>

    ${ready.ready?"":`<div class="production-readiness-warning"><strong>Production registration is protected.</strong><span>Complete: ${esc(ready.missing.join(" · "))}.</span></div>`}

    <div class="admin-form-grid">
      ${adminField("Tournament name","name",adminDraft.name)}
      ${adminField("Organizer","organizer",adminDraft.organizer)}
      ${adminField("Event date","eventDate",adminDraft.eventDate,"date")}
      ${adminField("Venue","venue",adminDraft.venue)}
      ${adminField("Registration opens","registrationOpening",adminDraft.registrationOpening,"date")}
      ${adminField("Registration deadline","registrationDeadline",adminDraft.registrationDeadline,"date")}
      ${adminField("Final player confirmation","finalPlayerConfirmation",adminDraft.finalPlayerConfirmation,"date")}
      ${adminField("Schedule release","scheduleRelease",adminDraft.scheduleRelease,"date")}
      ${adminField("Number of courts","numberOfCourts",adminDraft.numberOfCourts,"number")}
      ${adminTextarea("Participant eligibility","eligibilitySummary",adminDraft.eligibilitySummary)}
      ${adminTextarea("Tournament format summary","formatSummary",adminDraft.formatSummary)}
    </div>

    <section class="production-waiver-card">
      <div class="admin-panel-heading compact-heading">
        <div><p class="eyebrow">Required legal content</p><h3>Tournament waiver & consent</h3><p>This is the full waiver players explicitly acknowledge before submission.</p></div>
      </div>
      <div class="admin-form-grid">
        ${adminField("Waiver version","waiver.version",adminDraft.waiver?.version||"")}
        ${adminTextarea("Waiver summary","waiver.summary",adminDraft.waiver?.summary||"")}
        <label class="field full"><span>Full waiver text</span><textarea rows="14" data-admin-path="waiver.fullText">${esc(adminDisplayValue(adminDraft.waiver?.fullText||""))}</textarea><small>Production registration will not open while this is blank or still a placeholder.</small></label>
      </div>
    </section>`;
  }

  function adminDivisionCategorySelect(index,value){
    const options=[["men","Men's Doubles"],["women","Women's Doubles"],["mixed","Mixed Doubles"]];
    return `<label class="field"><span>Doubles category</span><select data-division-index="${index}" data-division-field="categoryKey">${options.map(([v,l])=>`<option value="${v}" ${v===value?"selected":""}>${esc(l)}</option>`).join("")}</select></label>`;
  }

  function renderAdminDivisions(){
    const divisions=adminDraft.divisions||[];
    return `<div class="admin-panel-heading">
      <div><p class="eyebrow">Registration architecture · Supabase live</p><h2>Divisions, fees & capacity</h2><p>Changes publish to the live registration engine. Team slots remaining are calculated from active registrations and cannot be manually edited.</p></div>
      <button class="button button-ghost" id="addDivisionButton" type="button">+ Add Division</button>
    </div>
    <div class="production-readiness-warning neutral"><strong>Production rule</strong><span>All enabled divisions use one tournament fee per player. Declined, Withdrawn and Cancelled teams do not consume capacity.</span></div>
    <div class="admin-division-list">${divisions.map((d,i)=>`<article class="admin-division-card">
      <header><div><span class="admin-index">${String(i+1).padStart(2,"0")}</span><strong>${esc(d.name||"Untitled division")}</strong></div><div class="admin-card-actions"><label class="switch-label"><input type="checkbox" data-division-index="${i}" data-division-field="enabled" ${d.enabled?"checked":""}/> Enabled</label><button class="icon-button danger" type="button" data-remove-division="${i}">×</button></div></header>
      <div class="admin-form-grid compact">
        ${adminDivisionField(i,"Division name","name",d.name)}
        ${adminDivisionLevelSelect(i,d.levelKey)}
        ${adminDivisionCategorySelect(i,d.categoryKey||divisionCategoryKey(d))}
        ${adminDivisionField(i,"Fee per player","fee",d.fee,"number")}
        ${adminDivisionField(i,"Capacity (team slots)","capacity",d.capacity,"number")}
        <label class="field"><span>Live slots remaining</span><input value="${esc(d.slotsRemaining??"—")}" disabled/><small>Calculated from Supabase registrations.</small></label>
      </div>
    </article>`).join("")}</div>`;
  }

  function renderAdminDuprRules(){
    const t=adminDraft.duprEligibility?.thresholds||{};
    return `<div class="admin-panel-heading"><div><p class="eyebrow">Level eligibility engine · Supabase live</p><h2>DUPR & Validation Rules</h2><p>These thresholds are shared by the Player portal and organizer verification workflow.</p></div><span class="status-pill">Server enforced</span></div>
      <div class="admin-form-grid">${adminDuprField("Low Intermediate starts at","duprEligibility.thresholds.lowIntermediateMin",t.lowIntermediateMin,"Ratings below this remain Beginner.")}${adminDuprField("High Intermediate starts at","duprEligibility.thresholds.highIntermediateMin",t.highIntermediateMin,"Must be higher than the Low Intermediate threshold.")}${adminDuprField("Advanced starts at","duprEligibility.thresholds.advancedMin",t.advancedMin,"Ratings at or above this threshold are Advanced.")}</div>
      <div class="admin-rule-note"><strong>Verification & pair rules</strong><p>DUPR players submit rating proof. Players without DUPR request a level, provide Club Affiliation and recent playing history, and may optionally add a supporting club/community link. Both partners must be in the same level. Male/Male, Female/Female, and Male/Female automatically determine Men's, Women's, and Mixed Doubles.</p></div>`;
  }

  function renderAdminAccess(){
    if(!can("access.manage"))return `<div class="empty-state"><strong>Access restricted.</strong>This section is available to the Director only.</div>`;
    const access=getAccessControl();
    if(!access.roles.some(r=>r.id===accessSelectedRoleId))accessSelectedRoleId="admin";
    return `<div class="access-page">
      <div class="admin-panel-heading">
        <div><p class="eyebrow">Director controls · centrally saved policy</p><h2>Access & Roles</h2><p>The role-policy workspace is stored in Supabase so it is consistent across Director devices.</p></div>
        <button class="button button-ghost" id="addAccessRole" type="button">+ Add Custom Role</button>
      </div>
      <div class="access-backend-note"><strong>Live enforcement still comes from Supabase Auth and get_my_admin_access().</strong><span>This page defines and centrally saves the intended policy. Adding a member here does not create a Supabase Auth account; the organizer account must already exist and be assigned server-side.</span></div>
      <div class="access-director-note"><div class="access-director-icon">D</div><div><strong>Director policy is protected</strong><span>The policy editor keeps a Director role and prevents accidental blueprint lockout.</span></div></div>
      <div class="access-role-workspace"><aside>${accessRoleCards()}</aside>${accessPermissionEditor()}</div>
      ${accessMembersTable()}
      ${accessAuditMarkup()}
      ${accessDialogMarkup()}
    </div>`;
  }

  function renderAdminNotifications(){
    if(!can("notifications.manage"))return `<div class="empty-state"><strong>Access restricted.</strong>Your role does not have permission to manage email notifications.</div>`;
    const settings=getEmailNotificationSettings();
    if(!settings.templates.some(t=>t.id===selectedEmailTemplateId))selectedEmailTemplateId=settings.templates[0]?.id||"registration_received";
    const template=settings.templates.find(t=>t.id===selectedEmailTemplateId)||settings.templates[0];
    const enabledCount=settings.templates.filter(t=>t.enabled).length;
    const emailEvents=getEmailActivity();

    return `<div class="email-notification-page">
      <div class="admin-panel-heading email-page-heading">
        <div><p class="eyebrow">Player communication · Supabase live</p><h2>Email Notifications</h2><p>Edit the same live templates used by the Gmail SMTP registration workflow.</p></div>
        <div class="email-page-actions"><button class="button button-primary" id="saveEmailNotifications" type="button">Save Live Templates</button></div>
      </div>

      <div class="email-preview-mode-note">
        <div class="email-preview-mode-icon">${settings.emailConfigured?"✓":"!"}</div>
        <div><strong>${settings.emailConfigured?"Gmail SMTP configured":"Email delivery not configured"}</strong><span>Template content is loaded from Supabase. Sender credentials remain protected in Supabase Secrets and are never shipped with this site.</span></div>
        <span class="email-connection-badge">${settings.emailConfigured?"Connected":"Check setup"}</span>
      </div>

      <div class="email-kpi-grid">
        <article><span>Live templates</span><strong>${settings.templates.length}</strong><small>Supabase notification templates</small></article>
        <article><span>Enabled</span><strong>${enabledCount}</strong><small>Messages currently active</small></article>
        <article><span>Delivery service</span><strong>${settings.emailConfigured?"Gmail SMTP":"Unavailable"}</strong><small>Server-side delivery</small></article>
        <article><span>Recent email events</span><strong>${emailEvents.length}</strong><small>Current paginated activity</small></article>
      </div>

      ${emailStatusFlow()}

      <section class="email-settings-card">
        <div class="email-settings-head"><div><span class="eyebrow">Sender identity</span><h3>Protected server configuration</h3></div></div>
        <div class="email-settings-grid">
          <label class="field"><span>Sender name</span><input value="${esc(settings.senderName)}" readonly /></label>
          <label class="field"><span>Reply-to email</span><input value="${esc(settings.replyTo)}" readonly /></label>
          <label class="field email-footer-field"><span>Security</span><input value="SMTP secrets are not exposed to GitHub Pages." readonly /></label>
        </div>
      </section>

      <div class="email-workspace">
        <aside class="email-template-sidebar">
          <div class="email-template-sidebar-head"><span class="eyebrow">Messages</span><h3>Live Templates</h3><p>Select a notification to edit and preview.</p></div>
          ${emailTemplateList(settings)}
        </aside>
        <section class="email-template-editor">
          <div class="email-editor-head"><div><span class="eyebrow">Selected notification</span><h3>${esc(template.label)}</h3><p>${esc(template.trigger)}</p></div><label class="email-template-switch"><input id="emailTemplateEnabled" type="checkbox" ${template.enabled?"checked":""}/><span></span><strong>${template.enabled?"Enabled":"Disabled"}</strong></label></div>
          <div class="email-editor-grid">
            <div class="email-editor-fields">
              <label class="field"><span>Subject line</span><input id="emailTemplateSubject" value="${esc(template.subject)}" /></label>
              <label class="field"><span>Email headline</span><input id="emailTemplateHeadline" value="${esc(template.headline)}" /></label>
              <label class="field"><span>Message</span><textarea id="emailTemplateBody" rows="11">${esc(template.body)}</textarea></label>
              <div class="email-cta-grid"><label class="field"><span>Button label</span><input id="emailTemplateCtaLabel" value="${esc(template.ctaLabel)}" /></label><label class="field"><span>Button link</span><input id="emailTemplateCtaUrl" value="${esc(template.ctaUrl)}" /></label></div>
              <div class="email-variables-card"><strong>Personalization fields</strong><span>The API replaces these tokens using live registration data.</span>${emailVariablesMarkup()}</div>
            </div>
            <div class="email-preview-column"><div class="email-preview-column-head"><div><span class="eyebrow">Preview</span><h3>What the player sees</h3></div><button class="button button-ghost" id="refreshEmailPreview" type="button">Refresh Preview</button></div><div id="emailTemplatePreview">${emailPreviewMarkup(template,settings)}</div></div>
          </div>
        </section>
      </div>

      <section class="email-activity-card">
        <div class="email-activity-head"><div><span class="eyebrow">Live delivery history</span><h3>Email Activity</h3><p>Recent delivery attempts are read from Supabase, not browser-local preview history.</p></div><span class="email-connection-badge">Live</span></div>
        ${emailActivityTableMarkup()}
      </section>
    </div>`;
  }

  function renderAdminActivity(){
    if(!can("access.manage"))return `<div class="empty-state"><strong>Access restricted.</strong>The Activity Log is available to Directors only.</div>`;
    const all=allActivityRows(),rows=filteredActivityRows(),k=activityKpis(all);
    const categories=[...new Set(all.map(row=>row.category).filter(Boolean))].sort();
    const actors=[...new Set(all.map(row=>row.actorName).filter(Boolean))].sort();

    return `<div class="activity-page">
      <div class="admin-panel-heading activity-page-heading">
        <div><p class="eyebrow">Permanent Supabase audit trail</p><h2>Activity Log</h2><p>Organizer decisions, payment actions, configuration updates and email events. Data loads 50 records at a time to control egress.</p></div>
        <div class="activity-page-actions"><button class="button button-ghost" id="exportActivityLog" type="button">Download Loaded Activity</button><button class="button button-ghost" id="refreshActivityLog" type="button">Refresh</button></div>
      </div>
      <div class="activity-kpi-grid">
        <article><span>Loaded activity</span><strong>${k.total}</strong><small>Current pages only</small></article>
        <article><span>Today</span><strong>${k.today}</strong><small>Actions in loaded pages</small></article>
        <article><span>Registration / eligibility</span><strong>${k.registration}</strong><small>Player decisions</small></article>
        <article><span>Access / authentication</span><strong>${k.access}</strong><small>Access/configuration</small></article>
        <article><span>Email workflow</span><strong>${k.email}</strong><small>Delivery events</small></article>
      </div>
      <section class="activity-filter-card">
        <label class="activity-search-field"><span>Search loaded activity</span><input id="activitySearch" type="search" value="${esc(activitySearch)}" placeholder="Reference, action, organizer…" /></label>
        <label><span>Category</span><select id="activityCategoryFilter"><option value="all">All categories</option>${categories.map(category=>`<option value="${esc(category)}" ${activityCategoryFilter===category?"selected":""}>${esc(category)}</option>`).join("")}</select></label>
        <label><span>Organizer / source</span><select id="activityActorFilter"><option value="all">All actors</option>${actors.map(actor=>`<option value="${esc(actor)}" ${activityActorFilter===actor?"selected":""}>${esc(actor)}</option>`).join("")}</select></label>
        <label><span>Date range</span><select id="activityDateFilter"><option value="1" ${activityDateFilter==="1"?"selected":""}>Last 24 hours</option><option value="7" ${activityDateFilter==="7"?"selected":""}>Last 7 days</option><option value="30" ${activityDateFilter==="30"?"selected":""}>Last 30 days</option><option value="all" ${activityDateFilter==="all"?"selected":""}>All loaded activity</option></select></label>
      </section>
      <section class="activity-table-card">
        <div class="activity-table-head"><div><strong>${rows.length} visible</strong><span>Newest loaded activity appears first.</span></div><span class="email-connection-badge">Supabase</span></div>
        ${rows.length?`<div class="activity-table-wrap"><table class="activity-table"><thead><tr><th>Date & time</th><th>Actor</th><th>Category</th><th>Activity</th><th>Target</th><th>Details</th></tr></thead><tbody>${rows.map(row=>{const stamp=activityTimestamp(row.at),tone=activityCategoryTone(row.category);return `<tr><td class="activity-time"><strong>${esc(stamp.date)}</strong><span>${esc(stamp.time)}</span></td><td><div class="activity-actor"><span class="activity-avatar">${esc((row.actorName||"S").slice(0,1).toUpperCase())}</span><div><strong>${esc(row.actorName||"System")}</strong><span>${esc(row.role||row.actorEmail||"")}</span></div></div></td><td><span class="activity-category ${esc(tone)}">${esc(row.category||"System")}</span></td><td><strong class="activity-action">${esc(row.action||"Activity")}</strong><span class="activity-source">${esc(row.source||"Supabase")}</span></td><td><strong>${esc(row.target||row.reference||"—")}</strong></td><td><span class="activity-details">${esc(row.details||"—")}</span>${row.result&&row.result!=="Completed"?`<small class="activity-result">${esc(row.result)}</small>`:""}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="activity-empty"><div>↻</div><strong>No activity matches these filters</strong><span>Refresh or adjust the filters.</span></div>`}
        <div class="activity-pagination-actions">${liveActivityNextBefore?`<button class="button button-ghost" id="loadMoreActivity" type="button">Load 50 More</button>`:`<span>No more loaded pages</span>`}</div>
      </section>
    </div>`;
  }

  async function downloadProductionBackup(){
    if(!can("backup.manage")){showToast("Your role cannot download backups");return}
    try{
      const response=await registrationAdminApi("admin-backup-export");
      download(JSON.stringify(response,null,2),`animo-production-config-backup-${new Date().toISOString().slice(0,10)}.json`,"application/json");
      showToast("Production configuration backup downloaded");
    }catch(error){
      showToast(error?.message||"Backup could not be downloaded");
    }
  }

  function renderAdminBackup(){
    return `<div class="admin-panel-heading">
      <div><p class="eyebrow">Production data safety</p><h2>Backup & Restore</h2><p>Configuration backup is separate from participant exports. Registration records remain server-authoritative and are never overwritten by browser restore.</p></div><span class="status-pill">Safe restore</span>
    </div>
    <div class="backup-grid">
      <article class="backup-card"><div class="backup-card-icon">↓</div><div class="backup-card-copy"><span class="admin-index">CONFIGURATION</span><h3>Download Production Backup</h3><p>Exports tournament settings, divisions, payment methods and live email templates from Supabase.</p></div><button class="button button-ghost" id="downloadBackupButton" type="button">Download Configuration Backup</button></article>
      <article class="backup-card backup-card-warning"><div class="backup-card-icon">↻</div><div class="backup-card-copy"><span class="admin-index">SAFE RESTORE</span><h3>Restore Configuration</h3><p>Restores configuration only. Registration records are never replaced or imported.</p><small>Use CSV/Excel exports separately for participant records.</small></div><button class="button button-ghost" id="restoreBackupButton" type="button">Choose Configuration Backup</button></article>
    </div>`;
  }


  async function importJson(file){
    if(!can("backup.manage")){showToast("Your role cannot restore backups");return}
    try{
      const parsed=JSON.parse(await file.text());
      if(!parsed||parsed.backupVersion!=="1.0")throw new Error("This is not an Animo Production 1.0 configuration backup.");
      if(!confirm("Restore this configuration backup? Registration records will NOT be changed."))return;

      if(parsed.portalConfig&&typeof parsed.portalConfig==="object"){
        const c=parsed.portalConfig;
        const sections=[
          ["details",["organizer","registrationOpening","registrationDeadline","finalPlayerConfirmation","scheduleRelease","eligibilitySummary","formatSummary","numberOfCourts"]],
          ["waiver",["waiver"]],
          ["dupr",["duprEligibility"]],
          ["hero",["heroCarousel"]],
          ["faq",["faq"]],
          ["contact",["contact"]],
          ["access",["accessControl"]]
        ];

        for(const [section,keys] of sections){
          const payload={};
          keys.forEach(key=>{if(key in c)payload[key]=c[key]});
          if(Object.keys(payload).length){
            await registrationAdminApi("admin-config-save",{
              section,
              config:payload,
              tournament:section==="details"?parsed.tournament:null
            });
          }
        }
      }

      if(Array.isArray(parsed.divisions)&&parsed.divisions.length){
        const fee=Number(parsed.tournament?.feePerPlayer||1800);
        await registrationAdminApi("admin-config-save",{
          section:"divisions",
          divisions:parsed.divisions.map(d=>({
            id:d.code,
            code:d.code,
            name:d.name,
            levelKey:({beginner:"beginner",low_intermediate:"lowIntermediate",high_intermediate:"highIntermediate",advanced:"advanced"})[d.level_key]||d.level_key,
            categoryKey:({mens:"men",womens:"women",mixed:"mixed"})[d.category]||d.category,
            capacity:d.team_capacity,
            fee,
            enabled:d.is_enabled
          }))
        });
      }

      if(Array.isArray(parsed.paymentMethods)){
        await registrationAdminApi("admin-payment-methods-save",{
          methods:parsed.paymentMethods.map((m,i)=>({
            id:m.method_key,
            label:m.label,
            enabled:m.enabled,
            accountName:m.account_name||"",
            accountNumber:m.account_number||"",
            instructions:m.instructions||"",
            sortOrder:m.sort_order??(i+1)*10,
            qrDataUrl:"",
            removeQr:false
          }))
        });
      }

      if(Array.isArray(parsed.emailTemplates)){
        await registrationAdminApi("admin-email-settings-save",{templates:parsed.emailTemplates});
      }

      await loadProductionConfig();
      await loadLivePortalState();
      await loadLivePaymentMethods({quiet:true});
      if(can("notifications.manage"))await loadProductionEmailSettings({quiet:true});
      renderAdmin();
      showToast("Production configuration restored");
    }catch(error){
      console.warn(error);
      showToast(error?.message||"Configuration backup could not be restored");
    }
  }

  async function saveConfiguration(){
    if(!currentTabCanSave()){showToast("Your role cannot change this configuration");return}

    if(adminTab==="dupr"){
      const t=adminDraft.duprEligibility?.thresholds||{};
      const low=Number(t.lowIntermediateMin),high=Number(t.highIntermediateMin),advanced=Number(t.advancedMin);
      if(![low,high,advanced].every(Number.isFinite)||!(low<high&&high<advanced)){
        showToast("DUPR thresholds must be numeric and strictly increasing");
        return;
      }
    }

    const button=$("#savePublishButton");
    if(button){button.disabled=true;button.textContent="Saving…"}

    try{
      if(adminTab==="details"){
        await registrationAdminApi("admin-config-save",{
          section:"details",
          tournament:{name:adminDraft.name,eventDate:adminDraft.eventDate,venue:adminDraft.venue},
          config:{
            organizer:adminDraft.organizer,
            registrationOpening:adminDraft.registrationOpening,
            registrationDeadline:adminDraft.registrationDeadline,
            finalPlayerConfirmation:adminDraft.finalPlayerConfirmation,
            scheduleRelease:adminDraft.scheduleRelease,
            eligibilitySummary:adminDraft.eligibilitySummary,
            formatSummary:adminDraft.formatSummary,
            numberOfCourts:adminDraft.numberOfCourts
          }
        });
        await registrationAdminApi("admin-config-save",{section:"waiver",config:{waiver:adminDraft.waiver||{}}});
      }else if(adminTab==="divisions"){
        await registrationAdminApi("admin-config-save",{
          section:"divisions",
          divisions:(adminDraft.divisions||[]).map(d=>({
            id:d.id,
            code:d.code||d.id,
            name:d.name,
            levelKey:d.levelKey,
            categoryKey:d.categoryKey||divisionCategoryKey(d),
            capacity:Number(d.capacity)||0,
            fee:Number(d.fee)||0,
            enabled:!!d.enabled
          }))
        });
      }else if(adminTab==="dupr"){
        await registrationAdminApi("admin-config-save",{section:"dupr",config:{duprEligibility:adminDraft.duprEligibility}});
      }else if(adminTab==="hero"){
        await registrationAdminApi("admin-config-save",{section:"hero",config:{heroCarousel:adminDraft.heroCarousel}});
      }else if(adminTab==="faq"){
        await registrationAdminApi("admin-config-save",{section:"faq",config:{faq:adminDraft.faq}});
      }else if(adminTab==="contact"){
        await registrationAdminApi("admin-config-save",{section:"contact",config:{contact:adminDraft.contact}});
      }else{
        showToast("This section has its own live save control");
        return;
      }

      await loadProductionConfig();
      await loadLivePortalState();
      renderAdmin();
      showToast("Changes published to Supabase");
    }catch(error){
      console.warn(error);
      showToast(error?.message||"Changes could not be published");
    }finally{
      if(button){button.disabled=false;button.textContent="Save Changes"}
    }
  }

  async function initializeAuthenticatedAdmin(){
    if(authInitializing)return;
    authInitializing=true;
    bindAuthUi();
    adminDraft=structuredClone(config);

    const restored=await restoreAdminSession();
    if(restored){
      adminTab=firstAccessibleTab();
      unlockAdmin();
      bindGlobal();

      const compatible=await checkBackendCompatibility();
      if(compatible){
        try{
          await loadProductionConfig();
          await loadLivePortalState();
          await loadLiveRegistrations({quiet:true});
          if(can("notifications.manage"))await loadProductionEmailSettings({quiet:true});
        }catch(error){
          console.warn("Production Admin initialization failed:",error);
        }
      }

      renderAdmin();
    }else{
      lockAdmin("");
      bindGlobal();
      const email=$("#adminLoginEmail");
      if(email)setTimeout(()=>email.focus(),50);
    }
    authInitializing=false;
  }

  let globalUiBound=false;
  function bindGlobal(){
    if(globalUiBound)return;
    globalUiBound=true;
    $$(".admin-tab").forEach(btn=>btn.onclick=async()=>{
      const needed=TAB_PERMISSIONS[btn.dataset.adminTab];
      if(needed&&!can(needed)){showToast("Your role does not have access to that section");return}
      adminTab=btn.dataset.adminTab;
      if(adminTab==="trash"&&!liveTrashLoaded){try{await loadTrashRecords({quiet:true})}catch(e){}}
      if(adminTab==="payments"&&!livePaymentMethodsLoaded){try{await loadLivePaymentMethods({quiet:true})}catch(e){}}
      if(adminTab==="notifications"){try{await loadProductionEmailSettings({quiet:true});await loadProductionActivity({reset:true,quiet:true})}catch(e){}}
      if(adminTab==="activity"){try{await loadProductionActivity({reset:true,quiet:true})}catch(e){}}
      renderAdmin();
    });

    const mobileNav=$("#adminMobileNav");
    if(mobileNav)mobileNav.onchange=async()=>{
      const next=mobileNav.value;
      const needed=TAB_PERMISSIONS[next];
      if(needed&&!can(needed)){showToast("Your role does not have access to that section");return}
      adminTab=next;
      if(adminTab==="trash"&&!liveTrashLoaded){try{await loadTrashRecords({quiet:true})}catch(e){}}
      if(adminTab==="payments"&&!livePaymentMethodsLoaded){try{await loadLivePaymentMethods({quiet:true})}catch(e){}}
      if(adminTab==="notifications"){try{await loadProductionEmailSettings({quiet:true});await loadProductionActivity({reset:true,quiet:true})}catch(e){}}
      if(adminTab==="activity"){try{await loadProductionActivity({reset:true,quiet:true})}catch(e){}}
      renderAdmin();
      window.scrollTo({top:0,behavior:"smooth"});
    };

    const savePublish=$("#savePublishButton");if(savePublish)savePublish.onclick=saveConfiguration;
    const exportButton=$("#exportCsvButton");if(exportButton)exportButton.onclick=exportCsv;
    const recordModalClose=$("#recordModalClose");if(recordModalClose)recordModalClose.onclick=()=>$("#recordModal").close();
    const importJsonInput=$("#importJsonInput");if(importJsonInput)importJsonInput.onchange=e=>{const f=e.target.files?.[0];if(f)importJson(f);e.target.value=""};
  }

  initializeAuthenticatedAdmin();
})();
