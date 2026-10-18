import '../shared/petContent';
import './noBrowserMenu';
import './fonts.css';
import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';import './styles.css';import './styles-friendly.css';import './styles-atelier.css';import './styles-fantasy.css';
import {GameBoundary} from './components/GameBoundary';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><GameBoundary><App/></GameBoundary></React.StrictMode>);
