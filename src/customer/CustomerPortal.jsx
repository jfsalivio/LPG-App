// Customer login and AR entry adapted from LPG-Mobile's Compose screens.
import { useEffect, useState } from 'react';
import { ArrowLeft, ScanLine, LogOut, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/logo-card.png';
import { customerRequest, CUSTOMER_TOKEN_KEY } from './customerApi';
import ARViewer from './ARViewer';
import './customer.css';

export default function CustomerPortal() {
  const [token, setToken] = useState(() => localStorage.getItem(CUSTOMER_TOKEN_KEY));
  const [customer, setCustomer] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [arOpen, setArOpen] = useState(() => window.location.hash === '#/customer/ar');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    customerRequest('/me', null, token).then(data => {
      if (active) { setCustomer(data); setError(''); }
    }).catch(err => {
      if (!active) return;
      setError(err.message);
      if (err.status === 401) { localStorage.removeItem(CUSTOMER_TOKEN_KEY); setToken(null); setCustomer(null); }
    });
    return () => { active = false; };
  }, [token, retry]);

  const submit = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const data = await customerRequest(registering ? '/register' : '/login', body);
      localStorage.setItem(CUSTOMER_TOKEN_KEY, data.token);
      setCustomer(data.customer); setToken(data.token);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const logout = () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY); setToken(null); setCustomer(null); setArOpen(false); setError('');
  };

  if (customer && arOpen) return <ARViewer onBack={() => setArOpen(false)} />;

  return <div className="customer-portal">
    <header className="customer-header">
      <a href="#" className="customer-back"><ArrowLeft size={18} /> Staff portal</a>
      <span>Customer portal</span>
      {customer && <button onClick={logout}><LogOut size={18} /> Sign out</button>}
    </header>
    <main className="customer-main">
      <img className="customer-logo" src={logo} alt="GasTrack" />
      {token && !customer ? <section className="customer-card">
        <h1>Checking your account…</h1>
        {error && <><p role="alert">{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry</button><button onClick={logout}>Back to login</button></>}
      </section> : customer ? <section className="customer-card customer-welcome">
        <span className="customer-eyebrow">YOUR LPG COMPANION</span>
        <h1>Welcome, {customer.fullName}</h1>
        <p>Open your camera and line up a cylinder with a tank reference.</p>
        <button className="customer-primary" onClick={() => setArOpen(true)}><ScanLine size={22} /> Open AR visual guide</button>
      </section> : <section className="customer-card">
        <span className="customer-eyebrow">CUSTOMER ACCOUNT</span>
        <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p>{registering ? 'Register to access your LPG visual guide.' : 'Sign in to your GasTrack customer account.'}</p>
        <form onSubmit={submit} className="customer-form">
          {registering && <>
            <label>First name<input name="firstName" autoComplete="given-name" required maxLength={75} /></label>
            <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={74} /></label>
            <label>Mobile number<input name="contactNo" type="tel" autoComplete="tel" required maxLength={30} /></label>
            <label>Address<textarea name="address" autoComplete="street-address" required maxLength={255} /></label>
          </>}
          <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label>Password<span className="customer-password"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : undefined} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></span></label>
          {registering && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} /></label>}
          {error && <p role="alert" className="customer-error">{error}</p>}
          <button className="customer-primary" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create customer account' : 'Sign in as customer'}</button>
        </form>
        <button className="customer-link" onClick={() => { setRegistering(value => !value); setError(''); }}>{registering ? 'Already registered? Sign in' : 'New here? Create an account'}</button>
      </section>}
    </main>
  </div>;
}
