import {useState} from 'react';
import {Eye,EyeOff,Lock,Mail,User} from 'lucide-react';
import {api} from './api';

/** Login, with "Ainda não tem conta? Cadastrar agora" switching to the sign-up form (usuário, e-mail, senha). */
export function AuthCard({initial='login',onSignedIn}:{initial?:'login'|'register';onSignedIn:()=>void}){
 const [mode,setMode]=useState(initial);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [show,setShow]=useState(false);
 const [form,setForm]=useState({login:'',username:'',email:'',password:''});
 const set=(key:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm({...form,[key]:e.target.value});
 const swap=(next:'login'|'register')=>{setMode(next);setError(null);setForm(f=>({...f,password:''}));};
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy)return;setBusy(true);setError(null);
  try{
   if(mode==='login')await api.login(form.login,form.password);
   else await api.register(form.username,form.email,form.password);
   onSignedIn();
  }catch(err){setError((err as Error).message);}finally{setBusy(false);}
 };
 const register=mode==='register';
 return <section className="auth-card" aria-labelledby="auth-title">
  <p className="eyebrow">{register?'Junte-se ao beta':'Sua aventura continua'}</p>
  <h2 id="auth-title" className="title-3d auth-title">{register?'Criar conta':'Entrar'}</h2>
  <form onSubmit={submit} noValidate>
   {register
    ?<>
     <Field icon={<User size={18}/>} label="Usuário" hint="3 a 16 letras, números ou _">
      <input value={form.username} onChange={set('username')} autoComplete="username" maxLength={16} required placeholder="Seu nome no jogo"/>
     </Field>
     <Field icon={<Mail size={18}/>} label="E-mail">
      <input type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={254} required placeholder="voce@email.com"/>
     </Field>
    </>
    :<Field icon={<User size={18}/>} label="Usuário ou e-mail">
     <input value={form.login} onChange={set('login')} autoComplete="username" maxLength={254} required placeholder="Seu usuário"/>
    </Field>}
   <Field icon={<Lock size={18}/>} label="Senha" hint={register?'Pelo menos 8 caracteres':undefined} action={<button type="button" className="field-eye" onClick={()=>setShow(!show)} aria-label={show?'Esconder senha':'Mostrar senha'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>}>
    <input type={show?'text':'password'} value={form.password} onChange={set('password')} autoComplete={register?'new-password':'current-password'} maxLength={128} required placeholder="••••••••"/>
   </Field>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="btn btn-gold btn-block btn-lg" disabled={busy}>{busy?'Aguarde…':register?'Cadastrar e jogar':'Entrar'}</button>
  </form>
  <div className="auth-switch">
   {register
    ?<>Já tem conta? <button type="button" onClick={()=>swap('login')}>Entrar</button></>
    :<>Ainda não tem conta? <button type="button" onClick={()=>swap('register')}>Cadastrar agora</button></>}
  </div>
  {register&&<p className="auth-note">A mesma conta vale para o site e para o jogo.</p>}
 </section>;
}

function Field({icon,label,hint,action,children}:{icon:React.ReactNode;label:string;hint?:string;action?:React.ReactNode;children:React.ReactNode}){
 return <label className="field">
  <span className="field-label">{label}{hint&&<small>{hint}</small>}</span>
  <span className="field-box">{icon}{children}{action}</span>
 </label>;
}
