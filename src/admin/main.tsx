import '../fonts.css';
import './admin.css';
// The game's pets and pet food, so the mail composer can list them.
import '../../shared/petContent';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {AdminApp} from './AdminApp';
ReactDOM.createRoot(document.getElementById('admin-root')!).render(<React.StrictMode><AdminApp/></React.StrictMode>);
