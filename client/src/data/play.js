export const MISSIONS=[
 ['m_brief','Run a brief in Command','Ask AJ to source, screen or report',50,'command'],
 ['m_studio','Complete an Agent Studio run','Take a requisition through all 9 stages',80,'#studio'],
 ['m_play','Finish Recruiter vs AJ','Screen all 8 CVs against the brief',60,'#play'],
 ['m_beat','Match AJ on all 8 CVs','Get every call right',100,'#play'],
 ['m_card','Open a candidate scorecard','See the six-factor breakdown',30,'pipeline'],
 ['m_approve','Approve an agent action','Clear an item in the approval queue',40,'approvals'],
 ['m_drag','Move a candidate yourself','Drag a card on the pipeline board',40,'pipeline'],
 ['m_sandbox','Run AJ on your own brief','Use Try it yourself with your JD or CSV',60,'sandbox'],
 ['m_report','Open the full TA report','Nine sections from the Analyst agent',30,'reports'],
 ['m_autonomy',"Change an agent's autonomy",'Set an agent to Suggest, Approve or Auto',30,'agents'],
 ['m_tour','Finish the guided tour','All 8 narrated steps',60,'tour'],
 ['m_auto','Test an automation','Run a recipe in Automations',40,'#auto'],
 ['m_ats','Run a full ATS sync','All 16 capabilities in the ATS Console',40,'atscon'],
 ['m_dl','Download a report','Any PDF or CSV export',30,'reports'],
 ['m_ai','Ask an open question with Live AI','Get a real AI answer in Command',50,'ai']];
export const LEVELS=[[0,'Rookie Recruiter','Rookie'],[150,'Talent Scout','Scout'],[330,'TA Pro','Pro'],[520,'TA Champion','Champion']];
export const JDG={role:'Senior Java Developer',city:'Pune',must:['Java','Spring Boot','AWS'],emin:5,emax:10,np:30};
export const CVS=[{t:'Backend Engineer',co:'a fintech product company',y:7,np:30,loc:'Pune',sk:['Java','Spring Boot','AWS','Kafka'],hl:'Led the move of a payments service to AWS'},
 {t:'Senior Developer',co:'an IT services firm',y:8,np:15,loc:'Pune',sk:['Java','Spring Boot','Docker','Hibernate'],hl:'Built REST APIs for a large retail client'},
 {t:'Java Tech Lead',co:'an e-commerce company',y:9,np:60,loc:'Pune',sk:['Java','Spring Boot','AWS','Microservices'],hl:'Leads a team of six backend engineers'},
 {t:'Software Engineer',co:'a SaaS start-up',y:4,np:0,loc:'Pune',sk:['Java','Spring Boot','AWS'],hl:'Shipped three customer-facing features this year'},
 {t:'Senior Software Engineer',co:'a global bank',y:6,np:15,loc:'Remote',sk:['Java','Spring Boot','AWS','Azure'],hl:'Owns the loan-processing microservice'},
 {t:'Full-stack Developer',co:'a media company',y:7,np:30,loc:'Pune',sk:['JavaScript','Node.js','React','AWS'],hl:"Built the company's content platform"},
 {t:'Senior Backend Engineer',co:'a logistics company',y:10,np:30,loc:'Pune',sk:['Java','Spring Boot','AWS','Kubernetes'],hl:'Scaled order tracking to 2M events a day'},
 {t:'Python Developer',co:'an analytics firm',y:6,np:30,loc:'Pune',sk:['Python','Django','AWS','SQL'],hl:'Built data pipelines for client dashboards'}];
