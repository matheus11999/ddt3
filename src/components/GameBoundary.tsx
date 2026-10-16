import {Component} from 'react';
import type {ErrorInfo,ReactNode} from 'react';
export class GameBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error,info:ErrorInfo){console.error('Game rendering error',error,info.componentStack);}
 render(){return this.state.failed?<div className="recovery-screen"><h1>Vamos voltar à aventura?</h1><p>O jogo encontrou um problema ao abrir esta tela.</p><button className="button gold" onClick={()=>location.reload()}>Reabrir o jogo</button></div>:this.props.children;}
}
