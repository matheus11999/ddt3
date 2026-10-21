import {useState} from 'react';
import {Check,Eye,EyeOff,Lock,Mail,User} from 'lucide-react';
import {api} from './api';

const USERNAME=/^[A-Za-z0-9_]{3,16}$/,EMAIL=/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/;
/** 0–4: length, mixed case, digits, symbols. */
function strength(password:string){return password.length<8?0:[/[a-z]/.test(password)&&/[A-Z]/.test(password),/\d/.test(password),/[^A-Za-z0-9]/.test(password),password.length>=12].filter(Boolean).length+1;}
const STRENGTH=['Muito curta','Fraca','Boa','Forte','Muito forte'];

/** Entrar / Criar conta in one card: tabs on top, "Ainda não tem conta? Cadastrar agora" under the login. */
export function AuthCard({initial='login',onSignedIn}:{initial?:'login'|'register';onSignedIn:()=>void}){
 const [mode,setMode]=useState(initial);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [show,setShow]=useState(false);
 const [touched,setTouched]=useState(false);
 const [form,setForm]=useState({login:'',username:'',email:'',password:'',again:''});
 const set=(key:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm({...form,[key]:e.target.value});
 const swap=(next:'login'|'register')=>{setMode(next);setError(null);setTouched(false);setForm(f=>({...f,password:'',again:''}));};
 const register=mode==='register';
 const checks=register?{
  username:USERNAME.test(form.username.trim()),
  email:EMAIL.test(form.email.trim()),
  password:form.password.length>=8,
  again:form.again.length>0&&form.again===form.password,
 }:null;
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy)return;setTouched(true);setError(null);
  if(checks&&!Object.values(checks).every(Boolean)){setError('Confira os campos marcados.');return;}
  setBusy(true);
  try{
   if(mode==='login')await api.login(form.login,form.password);
   else await api.register(form.username,form.email,form.password);
   onSignedIn();
  }catch(err){setError((err as Error).message);}finally{setBusy(false);}
 };
 const state=(ok:boolean,value:string)=>!touched&&!value?'':ok?'ok':'bad';
 const level=strength(form.password);
 const eye=<button type="button" className="field-eye" onClick={()=>setShow(!show)} aria-label={show?'Esconder senha':'Mostrar senha'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>;
 return <section className="auth-card" aria-label={register?'Criar conta':'Entrar'}>
  <div className="auth-tabs" role="tablist">
   <button type="button" role="tab" data-tab="login" aria-selected={!register} onClick={()=>swap('login')}>Entrar</button>
   <button type="button" role="tab" data-tab="register" aria-selected={register} onClick={()=>swap('register')}>Criar conta</button>
  </div>
  <h2 className="title-3d auth-title">{register?'Entre na beta':'Bem-vindo de volta'}</h2>
  <form onSubmit={submit} noValidate>
   {register&&checks
    ?<>
     <Field icon={<User size={18}/>} label="Usuário" hint="3 a 16 letras, números ou _" state={state(checks.username,form.username)}>
      <input value={form.username} onChange={set('username')} autoComplete="username" maxLength={16} required placeholder="Seu usuário" aria-label="Usuário"/>
     </Field>
     <Field icon={<Mail size={18}/>} label="E-mail" state={state(checks.email,form.email)}>
      <input type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={254} required placeholder="voce@email.com" aria-label="E-mail"/>
     </Field>
     <Field icon={<Lock size={18}/>} label="Senha" state={state(checks.password,form.password)} action={eye}>
      <input type={show?'text':'password'} value={form.password} onChange={set('password')} autoComplete="new-password" maxLength={128} required placeholder="8 caracteres ou mais" aria-label="Senha"/>
     </Field>
     {form.password&&<div className={`strength s${level}`} aria-live="polite"><span><i/><i/><i/><i/></span><small>{STRENGTH[level]}</small></div>}
     <Field icon={<Lock size={18}/>} label="Repita a senha" state={state(checks.again,form.again)}>
      <input type={show?'text':'password'} value={form.again} onChange={set('again')} autoComplete="new-password" maxLength={128} required placeholder="A mesma senha" aria-label="Repita a senha"/>
     </Field>
    </>
    :<>
     <Field icon={<User size={18}/>} label="Usuário ou e-mail">
      <input value={form.login} onChange={set('login')} autoComplete="username" maxLength={254} required placeholder="Seu usuário" aria-label="Usuário ou e-mail"/>
     </Field>
     <Field icon={<Lock size={18}/>} label="Senha" action={eye}>
      <input type={show?'text':'password'} value={form.password} onChange={set('password')} autoComplete="current-password" maxLength={128} required placeholder="Sua senha" aria-label="Senha"/>
     </Field>
    </>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="btn btn-gold btn-block btn-lg" disabled={busy}>{busy?'Aguarde…':register?'Criar conta':'Entrar'}</button>
  </form>
  <div className="auth-switch">
   {register
    ?<>Já tem conta? <button type="button" onClick={()=>swap('login')}>Entrar</button></>
    :<>Ainda não tem conta? <button type="button" onClick={()=>swap('register')}>Cadastrar agora</button></>}
  </div>
  {register&&<p className="auth-note">Uma conta só, pro site e pro jogo. O nome do personagem você escolhe dentro do jogo.</p>}
 </section>;
}

function Field({icon,label,hint,action,state='',children}:{icon:React.ReactNode;label:string;hint?:string;action?:React.ReactNode;state?:string;children:React.ReactNode}){
 return <label className={`field ${state}`}>
  <span className="field-label">{label}{hint&&<small>{hint}</small>}</span>
  <span className="field-box">{icon}{children}{state==='ok'&&<Check className="field-ok" size={18}/>}{action}</span>
 </label>;
}
