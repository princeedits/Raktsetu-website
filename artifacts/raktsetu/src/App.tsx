import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  useLocation, useSearch, Route, Switch, Router as WouterRouter, Link,
} from 'wouter';
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Droplet, HeartHandshake, Hospital,
  LockKeyhole, MapPin, Menu, Search, ShieldCheck, Siren, Users,
  X, XCircle, Phone, Send, LogOut, UserRound, Inbox, ClipboardList, Settings, Ban, Flag,
} from 'lucide-react';
import {
  useListDonors, getListDonorsQueryKey, useGetMyDonorProfile, getGetMyDonorProfileQueryKey,
  useListNearbyRequests, getListNearbyRequestsQueryKey, useListMyContactRequests,
  getListMyContactRequestsQueryKey, useTrackContactRequest, getTrackContactRequestQueryKey,
  useListBloodBanks, getListBloodBanksQueryKey, useTrackEmergencyRequest,
  getTrackEmergencyRequestQueryKey, useListBlockedDonors, getListBlockedDonorsQueryKey,
  useGetAdminOverview, getGetAdminOverviewQueryKey, useListAdminReports,
  getListAdminReportsQueryKey, useCreateEmergencyRequest, saveMyDonorProfile, updateMyDonorProfile,
  setDonorAvailability, createContactRequest, decideContactRequest, createDonorResponse,
  createReport, blockDonor, unblockDonor, updateAdminReport,
} from '@workspace/api-client-react';
import type { BloodGroup, DonorSummary, DonorProfileInput, EmergencyRequestInput } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

const groups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const navItems = [
  { href: '/', title: 'Find donors', icon: Search },
  { href: '/banks', title: 'Blood banks', icon: Hospital },
  { href: '/request', title: 'Emergency request', icon: Siren },
  { href: '/track', title: 'Track a request', icon: Activity },
  { href: '/requests', title: 'Nearby requests', icon: ClipboardList, protected: true },
  { href: '/inbox', title: 'Contact inbox', icon: Inbox, protected: true },
  { href: '/profile', title: 'My donor profile', icon: Settings, protected: true },
  { href: '/safety', title: 'Safety & privacy', icon: ShieldCheck, protected: true },
];

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? 'brand-light' : ''}`} data-testid="link-brand"><span className="brand-mark"><Droplet size={20} fill="currentColor" /></span><span>rakt<span>setu</span></span></Link>;
}
function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return <button className={`button button-${variant}`} {...props}>{children}</button>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function StatePanel({ title, body, retry, error = false }: { title: string; body: string; retry?: () => void; error?: boolean }) {
  const Icon = error ? CircleHelp : HeartHandshake;
  return <div className="state-panel"><span className="state-icon"><Icon size={23} /></span><h3>{title}</h3><p>{body}</p>{retry && <Button variant="outline" onClick={retry}>Try again</Button>}</div>;
}
function SkeletonRows() {
  return <div className="skeleton-list">{[0,1,2].map(n => <div className="skeleton-row" key={n}><i /><span><i /><i /></span><i /></div>)}</div>;
}
function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { if (isLoaded && !isSignedIn) setLocation('/sign-in'); }, [isLoaded, isSignedIn, setLocation]);
  if (!isLoaded || !isSignedIn) return <main className="page-wrap"><StatePanel title="A little more to continue" body="Sign in securely to manage your donor profile and private requests." /></main>;
  return <>{children}</>;
}
function Header() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const adminOverview = useGetAdminOverview({ query: { enabled: isSignedIn, queryKey: getGetAdminOverviewQueryKey(), retry: false } });
  const active = (href: string) => href === '/' ? location === '/' : location.startsWith(href);
  const links = [...navItems.filter(n => !n.protected || isSignedIn), ...(adminOverview.isSuccess ? [{ href: '/admin', title: 'Moderation', icon: ShieldCheck }] : [])];
  return <header className="topbar"><div className="topbar-inner"><Brand /><nav className={`main-nav ${open ? 'nav-open' : ''}`}>
    {links.map(item => <Link key={item.href} href={item.href} className={active(item.href) ? 'nav-link active' : 'nav-link'} data-testid={`link-nav-${item.href.slice(1) || 'home'}`}>{item.title}</Link>)}
  </nav><div className="top-actions">
    {isSignedIn ? <><Link href="/profile" className="profile-shortcut"><UserRound size={16} /> My account</Link><button className="icon-button signout" aria-label="Sign out" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={17} /></button></> : <><Link href="/sign-in" className="text-link">Sign in</Link><Link href="/sign-up" className="button button-primary button-small">Join as donor <ArrowRight size={14} /></Link></>}
  </div><button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button></div></header>;
}
function Layout({ children }: { children: ReactNode }) {
  return <div className="app-shell"><Header />{children}<Footer /></div>;
}
function Footer() {
  return <footer className="footer"><div className="footer-inner"><Brand /><p>When someone needs blood, a nearby human can make all the difference.</p><div className="footer-links"><Link href="/safety">Safety & privacy</Link><Link href="/banks">Blood banks</Link><Link href="/track">Track request</Link></div><small>RaktSetu connects people. In a medical emergency, contact your hospital or local emergency services.</small></div></footer>;
}
function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function Home() {
  const [city, setCity] = useState('');
  const [group, setGroup] = useState('');
  const [searching, setSearching] = useState(false);
  const params = searching ? { ...(group ? { bloodGroup: group as BloodGroup } : {}), ...(city ? { city } : {}), availableOnly: true, limit: 50 } : { availableOnly: true, limit: 50 };
  const donors = useListDonors(params);
  const list = donors.data || [];
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListDonorsQueryKey(params) });
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); setSearching(true); };
  return <main>
    <section className="hero"><div className="hero-pattern" /><div className="hero-content"><div className="eyebrow hero-eyebrow"><span className="live-dot" /> A bridge between a need and a willing hand</div><h1>Every drop brings<br /><em>someone closer.</em></h1><p className="hero-copy">Find blood donors near you. Reach out privately. Help can start with one thoughtful connection.</p>
      <form className="hero-search" onSubmit={submitSearch}><div className="search-field"><MapPin size={18} /><input aria-label="City" data-testid="input-search-city" placeholder="City or district" value={city} onChange={e => setCity(e.target.value)} /></div><div className="search-divider" /><div className="search-field group-field"><Droplet size={18} /><select aria-label="Blood group" data-testid="select-search-bloodgroup" value={group} onChange={e => setGroup(e.target.value)}><option value="">Any blood group</option>{groups.map(g => <option key={g}>{g}</option>)}</select><ChevronDown size={15} /></div><button type="submit" className="search-submit" data-testid="button-find-donors"><Search size={17} /><span>Find donors</span></button></form>
      <div className="privacy-caption"><LockKeyhole size={14} /> Phone numbers stay private unless a donor chooses to share.</div>
    </div><div className="hero-side"><div className="hero-emblem"><div className="emblem-ring ring-one" /><div className="emblem-ring ring-two" /><div className="emblem-core"><Droplet size={54} fill="currentColor" /></div><span className="orbit orbit-a"><HeartHandshake size={20} /></span><span className="orbit orbit-b"><MapPin size={20} /></span></div><div className="hero-note"><span className="note-marker" /><div><strong>Care, with consent.</strong><small>Each connection begins with permission.</small></div></div></div></section>
    <section className="trust-strip"><span><ShieldCheck size={17} /> Privacy-first by default</span><span><BadgeCheck size={17} /> Community-led connections</span><span><HeartHandshake size={17} /> Built for India, built for care</span></section>
    <section className="directory-section page-wrap" id="donors"><div className="section-intro"><div><div className="eyebrow">The donor directory</div><h2>People ready to help.</h2><p>Donors who have chosen to be available in their community.</p></div><Link href="/register-donor" className="subtle-link">Become a donor <ArrowUpRight size={16} /></Link></div>
      {donors.isLoading ? <SkeletonRows /> : donors.isError ? <StatePanel title="We couldn't load the directory" body="Please check your connection and try the search again." retry={refresh} error /> : list.length === 0 ? <StatePanel title={searching ? 'No available donors found yet' : 'The directory is ready for you'} body={searching ? 'Try another city or blood group. You can also contact a nearby blood bank.' : 'Try searching by city, or share your availability to help someone nearby.'} /> :
      <div className="donor-grid">{list.map((d, i) => <DonorCard donor={d} index={i} key={d.id} />)}</div>}
    </section>
    <section className="help-band"><div className="help-band-inner"><div><div className="eyebrow eyebrow-light">For the moment that matters</div><h2>Need blood urgently?</h2><p>Share the essential details. Nearby donors can respond without your information being made public.</p></div><Link href="/request" className="button button-light">Create an emergency request <ArrowRight size={16} /></Link></div></section>
    <section className="how-section page-wrap"><div className="eyebrow">Simple. Human. Private.</div><h2>Help moves at the speed<br />of a good connection.</h2><div className="steps"><article><span className="step-num">01</span><div className="step-icon"><Search size={21} /></div><h3>Find nearby</h3><p>Search by blood group and city to see available community donors.</p></article><article><span className="step-num">02</span><div className="step-icon"><Send size={21} /></div><h3>Ask privately</h3><p>Send a contact request with context. Personal details are never listed publicly.</p></article><article><span className="step-num">03</span><div className="step-icon"><HeartHandshake size={21} /></div><h3>Connect by consent</h3><p>The donor decides whether to accept and share their number with you.</p></article></div></section>
  </main>;
}
function DonorCard({ donor, index }: { donor: DonorSummary; index: number }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [sent, setSent] = useState('');
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyMessage, setSafetyMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  async function requestContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isSignedIn) { setLocation('/sign-in'); return; }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const result = await createContactRequest(donor.id, { requesterName: String(form.get('name')), requesterPhone: String(form.get('phone')), requesterEmail: String(form.get('email') || '') || null, message: String(form.get('message')) });
      setSent(result.trackingCode); setRequestOpen(false);
    } catch { setSent('error'); } finally { setBusy(false); }
  }
  async function blockThisDonor() {
    if (!isSignedIn) { setLocation('/sign-in'); return; }
    if (!window.confirm(`Block ${donor.displayName}? They will no longer be able to contact you.`)) return;
    setSafetyBusy(true); setSafetyMessage('');
    try { await blockDonor({ donorId: donor.id }); setSafetyMessage('Donor blocked. You can manage this in Safety & privacy.'); }
    catch { setSafetyMessage('This donor could not be blocked. Please retry.'); } finally { setSafetyBusy(false); }
  }
  async function reportThisDonor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isSignedIn) { setLocation('/sign-in'); return; }
    const f = new FormData(e.currentTarget); setSafetyBusy(true); setSafetyMessage('');
    try {
      await createReport({ subjectType: 'donor', subjectId: donor.id, reason: String(f.get('reason')) as 'incorrect_information' | 'abuse' | 'fraud' | 'safety_concern' | 'other', details: String(f.get('details')) });
      setSafetyMessage('Report sent to our moderation team.'); setReportOpen(false);
    } catch { setSafetyMessage('We could not send this report. Please try again.'); } finally { setSafetyBusy(false); }
  }
  const initials = donor.displayName.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  return <article className="donor-card" style={{ animationDelay: `${index * 55}ms` }} data-testid={`card-donor-${donor.id}`}><div className="donor-card-head"><div className="donor-avatar">{initials}</div><span className="availability"><i /> Available</span></div><h3>{donor.displayName}</h3><div className="donor-meta"><span className="blood-chip">{donor.bloodGroup}</span><span><MapPin size={13} />{donor.area}, {donor.city}</span></div><div className="donor-card-foot"><span className="private-label"><LockKeyhole size={13} /> Contact private</span><button className="text-link" onClick={() => isSignedIn ? setRequestOpen(!requestOpen) : setLocation('/sign-in')} data-testid={`button-contact-${donor.id}`}>Request contact <ArrowRight size={14} /></button></div>
    <div className="donor-safety"><button type="button" onClick={blockThisDonor} disabled={safetyBusy}><Ban size={12} /> Block</button><button type="button" onClick={() => isSignedIn ? setReportOpen(!reportOpen) : setLocation('/sign-in')}><Flag size={12} /> Report</button></div>
    {safetyMessage && <p className="safety-message">{safetyMessage}</p>}
    {reportOpen && <form className="donor-report-form" onSubmit={reportThisDonor}><Field label="Reason"><select name="reason"><option value="safety_concern">Safety concern</option><option value="incorrect_information">Incorrect information</option><option value="abuse">Abuse</option><option value="fraud">Fraud</option><option value="other">Other</option></select></Field><Field label="Details"><textarea name="details" required minLength={4} maxLength={1000} placeholder="Tell us what happened" /></Field><Button disabled={safetyBusy}>{safetyBusy ? 'Sending…' : 'Send report'}</Button></form>}
    {sent && <div className={`inline-result ${sent === 'error' ? 'inline-error' : ''}`}>{sent === 'error' ? 'Request could not be sent. Try again.' : <>Request sent. Keep this code: <strong>{sent}</strong></>}</div>}
    {requestOpen && <form onSubmit={requestContact} className="contact-form"><Field label="Your name"><input name="name" required minLength={2} placeholder="Full name" /></Field><Field label="Phone number"><input name="phone" required minLength={8} placeholder="+91" /></Field><Field label="Email (optional)"><input type="email" name="email" placeholder="you@example.com" /></Field><Field label="Why are you reaching out?"><textarea name="message" required minLength={4} maxLength={500} placeholder="A little context helps the donor decide" /></Field><Button disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button></form>}
  </article>;
}
function RegisterPage() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!isSignedIn) { setLocation('/sign-in'); return; }
    const f = new FormData(e.currentTarget);
    const payload: DonorProfileInput = { displayName: String(f.get('name')), bloodGroup: String(f.get('bloodGroup')) as BloodGroup, city: String(f.get('city')), area: String(f.get('area')), phone: String(f.get('phone')), lastDonatedAt: String(f.get('lastDonatedAt') || '') || null, shareContact: f.get('shareContact') === 'on', notificationsEnabled: f.get('notifications') === 'on' };
    setBusy(true); setError('');
    try { await saveMyDonorProfile(payload); await queryClient.invalidateQueries({ queryKey: getGetMyDonorProfileQueryKey() }); await queryClient.invalidateQueries({ queryKey: getListDonorsQueryKey() }); setSaved(true); }
    catch { setError('We could not save your profile. Please review the details and try again.'); } finally { setBusy(false); }
  }
  return <main className="page-wrap narrow"><PageHeading eyebrow="A generous choice" title="Register as a donor" description="Make yourself discoverable to people nearby. You stay in control of every connection." />{!isSignedIn ? <AuthPrompt /> : saved ? <div className="success-panel"><CheckCircle2 size={28} /><h2>Your profile is ready.</h2><p>Your phone number remains private. You can change your availability whenever life calls for it.</p><Link className="button button-primary" href="/profile">Manage my profile</Link></div> :
  <form className="surface form-card" onSubmit={submit}><div className="form-section"><h3>About you</h3><div className="form-grid"><Field label="Name"><input name="name" required minLength={2} maxLength={80} placeholder="How should we address you?" /></Field><Field label="Blood group"><select name="bloodGroup" required defaultValue=""><option value="" disabled>Select group</option>{groups.map(g => <option key={g}>{g}</option>)}</select></Field><Field label="City"><input name="city" required minLength={2} placeholder="e.g. Pune" /></Field><Field label="Area or neighbourhood"><input name="area" required minLength={2} placeholder="e.g. Baner" /></Field><Field label="Phone number" hint="Kept private; shown only after you approve a specific request."><input name="phone" type="tel" minLength={8} required placeholder="+91" /></Field><Field label="Last donation (optional)"><input name="lastDonatedAt" type="date" /></Field></div></div><div className="consent-box"><label className="check-row"><input type="checkbox" name="shareContact" /><span><strong>Allow contact sharing when I approve</strong><small>Your number is still never public. You can decide request by request.</small></span></label><label className="check-row"><input type="checkbox" name="notifications" defaultChecked /><span><strong>In-app notifications</strong><small>Receive contact requests in your RaktSetu inbox.</small></span></label></div>{error && <div className="form-error">{error}</div>}<Button disabled={busy}>{busy ? 'Saving profile…' : 'Save donor profile'} <ArrowRight size={16} /></Button></form>}</main>;
}
function AuthPrompt() { return <div className="auth-prompt surface"><span className="state-icon"><LockKeyhole size={22} /></span><h3>Sign in to save your donor profile</h3><p>Your profile, availability, and contact preferences belong to you.</p><Link className="button button-primary" href="/sign-in">Sign in securely <ArrowRight size={15} /></Link></div>; }
function ProfilePage() {
  const { isSignedIn } = useAuth();
  const profile = useGetMyDonorProfile({ query: { enabled: isSignedIn, queryKey: getGetMyDonorProfileQueryKey() } });
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [formState, setFormState] = useState({ displayName: '', bloodGroup: 'O+' as BloodGroup, city: '', area: '', phone: '', lastDonatedAt: '', shareContact: false, notificationsEnabled: true });
  const initializedForId = useRef<string | null>(null);
  useEffect(() => {
    if (profile.data && initializedForId.current !== profile.data.id) {
      initializedForId.current = profile.data.id;
      setFormState({ displayName: profile.data.displayName, bloodGroup: profile.data.bloodGroup, city: profile.data.city, area: profile.data.area, phone: profile.data.phone, lastDonatedAt: profile.data.lastDonatedAt?.slice(0,10) || '', shareContact: profile.data.shareContact, notificationsEnabled: profile.data.notificationsEnabled });
    }
  }, [profile.data]);
  if (!isSignedIn) return <main className="page-wrap narrow"><PageHeading eyebrow="Your account" title="Donor profile" description="Your availability and privacy choices." /><AuthPrompt /></main>;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await updateMyDonorProfile({ ...formState, lastDonatedAt: formState.lastDonatedAt || null }); await queryClient.invalidateQueries({ queryKey: getGetMyDonorProfileQueryKey() }); await queryClient.invalidateQueries({ queryKey: getListDonorsQueryKey() }); setNotice('Your preferences are saved.'); }
    catch { setError('Profile changes could not be saved. Please try again.'); } finally { setBusy(false); }
  }
  async function toggleAvailability() {
    if (!profile.data) return; setBusy(true);
    try { await setDonorAvailability({ available: !profile.data.available }); await queryClient.invalidateQueries({ queryKey: getGetMyDonorProfileQueryKey() }); await queryClient.invalidateQueries({ queryKey: getListDonorsQueryKey() }); setNotice('Availability updated.'); }
    catch { setError('Availability could not be updated.'); } finally { setBusy(false); }
  }
  return <main className="page-wrap narrow"><PageHeading eyebrow="Your account" title="Donor profile" description="Your availability and privacy choices, always yours to change." />
    {profile.isLoading ? <SkeletonRows /> : profile.isError || !profile.data ? <StatePanel title="Donor profile not found" body="Create a donor profile to manage your availability and contact preferences." error /> :
      <><div className="availability-panel surface"><div><span className={`availability-large ${profile.data.available ? 'is-available' : ''}`}><i />{profile.data.available ? 'Available to help' : 'Taking a pause'}</span><h3>{profile.data.displayName} <span className="blood-chip">{profile.data.bloodGroup}</span></h3><p>{profile.data.area}, {profile.data.city}</p></div><Button variant={profile.data.available ? 'outline' : 'primary'} disabled={busy} onClick={toggleAvailability}>{profile.data.available ? 'Pause availability' : 'I’m available'}</Button></div>
      <form className="surface form-card profile-edit" onSubmit={save}><h3>Profile & preferences</h3><div className="form-grid"><Field label="Display name"><input required value={formState.displayName} onChange={e => setFormState({ ...formState, displayName: e.target.value })} /></Field><Field label="Blood group"><select value={formState.bloodGroup} onChange={e => setFormState({ ...formState, bloodGroup: e.target.value as BloodGroup })}>{groups.map(g => <option key={g}>{g}</option>)}</select></Field><Field label="City"><input required value={formState.city} onChange={e => setFormState({ ...formState, city: e.target.value })} /></Field><Field label="Area"><input required value={formState.area} onChange={e => setFormState({ ...formState, area: e.target.value })} /></Field><Field label="Phone number"><input type="tel" required value={formState.phone} onChange={e => setFormState({ ...formState, phone: e.target.value })} /></Field><Field label="Last donation"><input type="date" value={formState.lastDonatedAt} onChange={e => setFormState({ ...formState, lastDonatedAt: e.target.value })} /></Field></div><div className="consent-box"><label className="check-row"><input type="checkbox" checked={formState.shareContact} onChange={e => setFormState({ ...formState, shareContact: e.target.checked })} /><span><strong>May share my phone when I explicitly accept</strong><small>Even with this on, each request requires your approval.</small></span></label><label className="check-row"><input type="checkbox" checked={formState.notificationsEnabled} onChange={e => setFormState({ ...formState, notificationsEnabled: e.target.checked })} /><span><strong>In-app notifications</strong><small>Receive new contact requests here.</small></span></label></div>{error && <p className="form-error">{error}</p>}{notice && <p className="form-success">{notice}</p>}<Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={15} /></Button></form></>}</main>;
}
function BanksPage() {
  const [city, setCity] = useState('');
  const [filter, setFilter] = useState('');
  const params = filter ? { city: filter, limit: 100 } : { limit: 100 };
  const banks = useListBloodBanks(params);
  const qc = useQueryClient();
  return <main className="page-wrap"><PageHeading eyebrow="Community directory" title="Blood banks near you" description="Find a local blood bank and confirm current availability directly with the team." />
    <form className="filter-bar" onSubmit={e => { e.preventDefault(); setFilter(city); }}><div className="search-field"><MapPin size={17} /><input value={city} onChange={e => setCity(e.target.value)} placeholder="Search by city" data-testid="input-bank-city" /></div><Button><Search size={16} /> Search banks</Button></form>
    {banks.isLoading ? <SkeletonRows /> : banks.isError ? <StatePanel title="Blood banks aren't available right now" body="Please retry in a moment." error retry={() => qc.invalidateQueries({ queryKey: getListBloodBanksQueryKey(params) })} /> : (banks.data || []).length === 0 ? <StatePanel title="No blood banks found" body="Try a nearby city or a different spelling." /> : <div className="bank-grid">{banks.data?.map(bank => <article className="bank-card surface" key={bank.id} data-testid={`card-bank-${bank.id}`}><div className="bank-card-top"><span className="bank-icon"><Hospital size={21} /></span>{bank.verified && <span className="verified"><BadgeCheck size={14} /> Verified listing</span>}</div><h3>{bank.name}</h3><p className="bank-area">{bank.area}, {bank.city}</p><p className="bank-address"><MapPin size={15} />{bank.address}</p><div className="bank-hours"><Clock3 size={15} />{bank.hours}</div><a className="button button-outline bank-call" href={`tel:${bank.phone}`}><Phone size={15} /> Call blood bank</a></article>)}</div>}
  </main>;
}
function RequestPage() {
  const create = useCreateEmergencyRequest();
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ trackingCode: string; id: string } | null>(null);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!isSignedIn) { setLocation('/sign-in'); return; }
    const f = new FormData(e.currentTarget);
    const data: EmergencyRequestInput = { patientName: String(f.get('patientName')), contactPhone: String(f.get('phone')), bloodGroup: String(f.get('bloodGroup')) as BloodGroup, city: String(f.get('city')), area: String(f.get('area')), hospital: String(f.get('hospital')), units: Number(f.get('units')), urgency: String(f.get('urgency')) as EmergencyRequestInput['urgency'], neededBy: String(f.get('neededBy') || '') || null, details: String(f.get('details') || ''), consentToContact: true };
    setError('');
    create.mutate({ data }, { onSuccess: result => setCreated({ trackingCode: result.trackingCode, id: result.id }), onError: () => setError('Your request could not be submitted. Please check the details and try again.') });
  }
  return <main className="page-wrap narrow"><PageHeading eyebrow="Urgent connection" title="Request blood" description="Share what is needed so nearby donors can decide whether they can help." />
    {!isSignedIn && <div className="soft-notice"><LockKeyhole size={17} /> Sign in is required to publish a request. Your details are shared only for this request.</div>}
    {created ? <div className="success-panel"><CheckCircle2 size={29} /><div className="eyebrow">Request submitted</div><h2>Help is being matched.</h2><p>Keep your tracking code safe. Use it to follow responses from donors.</p><div className="tracking-code">{created.trackingCode}</div><Link href={`/track?code=${encodeURIComponent(created.trackingCode)}`} className="button button-primary">Track this request <ArrowRight size={16} /></Link></div> :
    <form onSubmit={submit} className="surface form-card"><div className="urgent-banner"><span className="urgent-symbol"><Siren size={20} /></span><div><strong>Only share essential details.</strong><small>Your request is visible to donors who are signed in. Contact details are not listed publicly.</small></div></div>
      <div className="form-grid"><Field label="Patient or contact name"><input required name="patientName" minLength={2} placeholder="Name" /></Field><Field label="Contact phone"><input required name="phone" type="tel" minLength={8} placeholder="+91" /></Field><Field label="Blood group"><select name="bloodGroup" required defaultValue=""><option value="" disabled>Select group</option>{groups.map(g => <option key={g}>{g}</option>)}</select></Field><Field label="Units needed"><input required name="units" type="number" min="1" max="20" defaultValue="1" /></Field><Field label="City"><input required name="city" minLength={2} placeholder="City" /></Field><Field label="Area"><input required name="area" minLength={2} placeholder="Area or neighbourhood" /></Field><Field label="Hospital"><input required name="hospital" minLength={2} placeholder="Hospital name" /></Field><Field label="Needed by"><input name="neededBy" type="datetime-local" /></Field><Field label="Urgency"><select name="urgency" defaultValue="urgent"><option value="critical">Critical — needed now</option><option value="urgent">Urgent — within 24 hours</option><option value="planned">Planned — future date</option></select></Field><Field label="Details (optional)"><textarea name="details" maxLength={1000} placeholder="Any useful context for potential donors" /></Field></div>
      <label className="check-row consent-row"><input type="checkbox" required /><span><strong>I consent to sharing these details with responding donors.</strong><small>This lets donors contact you about this request only.</small></span></label>{error && <p className="form-error">{error}</p>}<Button disabled={create.isPending}>{create.isPending ? 'Submitting request…' : 'Submit blood request'} <ArrowRight size={16} /></Button></form>}</main>;
}
function TrackPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const initial = new URLSearchParams(search).get('code') || '';
  const [input, setInput] = useState(initial);
  const [code, setCode] = useState(initial);
  const emergency = useTrackEmergencyRequest(code, { query: { enabled: Boolean(code), queryKey: getTrackEmergencyRequestQueryKey(code) } });
  const contact = useTrackContactRequest(code, { query: { enabled: Boolean(code), queryKey: getTrackContactRequestQueryKey(code) } });
  const result = emergency.data || contact.data;
  const loading = Boolean(code) && !result && (emergency.isLoading || contact.isLoading);
  const error = Boolean(code) && !result && emergency.isError && contact.isError;
  const [response, setResponse] = useState('');
  const [share, setShare] = useState(false);
  const [sending, setSending] = useState(false);
  const [responseError, setResponseError] = useState('');
  const { isSignedIn } = useAuth();
  const qc = useQueryClient();
  async function respond(e: React.FormEvent) {
    e.preventDefault(); if (!isSignedIn) { setLocation('/sign-in'); return; }
    if (!result || !('hospital' in result)) return;
    setSending(true); setResponseError('');
    try { await createDonorResponse(result.id, { message: response, shareContact: share }); await qc.invalidateQueries({ queryKey: getTrackEmergencyRequestQueryKey(code) }); setResponse(''); }
    catch { setResponseError('Your response could not be sent. Please try again.'); } finally { setSending(false); }
  }
  return <main className="page-wrap narrow"><PageHeading eyebrow="Request status" title="Track a request" description="Enter the tracking code you received after submitting a request." />
    <form className="tracking-search" onSubmit={e => { e.preventDefault(); setCode(input.trim()); }}><div className="search-field"><Activity size={18} /><input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter tracking code" aria-label="Tracking code" data-testid="input-tracking-code" required /></div><Button>Track request <ArrowRight size={15} /></Button></form>
    {!code ? <div className="track-empty"><div className="track-art"><Activity size={27} /></div><h3>Your request, in view.</h3><p>Enter the code from your confirmation to see its latest status and donor responses.</p></div> : loading ? <SkeletonRows /> : error || !result ? <StatePanel title="We couldn't find that code" body="Check for typing errors or use the code from your request confirmation." error /> :
      <div className="track-result surface"><div className="result-top"><span className="status-pill"><i />{result.status}</span><span className="tracking-ref">Code {code}</span></div>
        {'hospital' in result ? <><div className="blood-highlight">{result.bloodGroup}</div><h2>{result.units} unit{result.units > 1 ? 's' : ''} needed at {result.hospital}</h2><p className="result-location"><MapPin size={15} />{result.area}, {result.city}</p><div className="result-facts"><span><strong>Urgency</strong>{result.urgency}</span><span><strong>Created</strong>{new Date(result.createdAt).toLocaleString()}</span></div><div className="response-list"><h3>Donor responses <span>{result.responses.length}</span></h3>{result.responses.length ? result.responses.map(r => <article className="response-card" key={r.id}><div className="response-title"><strong>{r.donorName}</strong><small>{new Date(r.createdAt).toLocaleString()}</small></div><p>{r.message}</p>{r.shareContact && r.donorPhone && <a href={`tel:${r.donorPhone}`} className="consented-contact"><Phone size={14} />{r.donorPhone}</a>}</article>) : <p className="muted">No donor responses yet. Nearby donors may still respond.</p>}</div><form className="response-form" onSubmit={respond}><h3>Can you help?</h3><Field label="Message to requester"><textarea required minLength={2} maxLength={500} value={response} onChange={e => setResponse(e.target.value)} placeholder="Let them know how you can help" /></Field><label className="check-row"><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} /><span><strong>Share my phone number for this request</strong><small>Request-specific consent. You decide each time.</small></span></label>{responseError && <p className="form-error">{responseError}</p>}<Button disabled={sending}>{sending ? 'Sending…' : 'Send donor response'} <Send size={15} /></Button></form></> :
        <><div className="eyebrow">Contact request</div><h2>Connection with {result.donorName}</h2><div className="status-steps"><span className="completed"><Check size={15} /> Request sent</span><span className={result.status !== 'pending' ? 'completed' : ''}>{result.status === 'pending' ? <Clock3 size={15} /> : result.status === 'accepted' ? <Check size={15} /> : <XCircle size={15} />} {result.status}</span></div>{result.status === 'accepted' && result.sharePhone && result.donorPhone ? <div className="consented-contact"><Phone size={16} /> Donor chose to share: <a href={`tel:${result.donorPhone}`}>{result.donorPhone}</a></div> : <p className="muted">The donor's contact details remain private unless they choose to share them.</p>}</>}
      </div>}
  </main>;
}
function RequestsPage() {
  const { isSignedIn } = useAuth();
  const requests = useListNearbyRequests({ limit: 50 }, { query: { enabled: isSignedIn, queryKey: getListNearbyRequestsQueryKey({ limit: 50 }) } });
  const qc = useQueryClient();
  if (!isSignedIn) return <main className="page-wrap"><PageHeading eyebrow="Donor community" title="Nearby requests" description="Help requests from people in your community." /><AuthPrompt /></main>;
  return <main className="page-wrap"><PageHeading eyebrow="Donor community" title="Nearby requests" description="Respond when you are able. Your contact details stay private unless you choose to share them." />
    {requests.isLoading ? <SkeletonRows /> : requests.isError ? <StatePanel title="Requests could not load" body="Please try again." error retry={() => qc.invalidateQueries({ queryKey: getListNearbyRequestsQueryKey({ limit: 50 }) })} /> : requests.data?.length ? <div className="request-grid">{requests.data.map(r => <RequestOpportunity key={r.id} request={r} />)}</div> : <StatePanel title="No nearby requests right now" body="When a request is posted in your area, it will appear here." />}
  </main>;
}
function RequestOpportunity({ request }: { request: { id: string; bloodGroup: BloodGroup; city: string; area: string; hospital: string; units: number; urgency: string; status: string; createdAt: string } }) {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [share, setShare] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) { setLocation('/sign-in'); return; }
    setBusy(true); setError('');
    try { await createDonorResponse(request.id, { message, shareContact: share }); await queryClient.invalidateQueries({ queryKey: getListNearbyRequestsQueryKey({ limit: 50 }) }); setNotice('Your response is on its way.'); setShowForm(false); }
    catch { setError('Your response could not be sent. Please retry.'); } finally { setBusy(false); }
  }
  return <article className="request-card surface" data-testid={`card-request-${request.id}`}><div className="request-top"><span className="blood-chip">{request.bloodGroup}</span><span className={`urgency-tag ${request.urgency}`}>{request.urgency}</span></div><h3>{request.units} unit{request.units > 1 ? 's' : ''} at {request.hospital}</h3><p><MapPin size={14} />{request.area}, {request.city}</p><div className="request-meta"><span><Clock3 size={13} />{new Date(request.createdAt).toLocaleString()}</span><span className="status-label">{request.status}</span></div>{notice ? <p className="form-success">{notice}</p> : <button className="subtle-link response-toggle" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel response' : 'I can help'} <ArrowRight size={15} /></button>}
    {showForm && <form className="opportunity-form" onSubmit={submit}><Field label="Message to requester"><textarea required minLength={2} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} placeholder="Let them know how you can help" /></Field><label className="check-row"><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} /><span><strong>Share phone for this request</strong><small>Only when you explicitly choose.</small></span></label>{error && <p className="form-error">{error}</p>}<Button disabled={busy}>{busy ? 'Sending…' : 'Send response'}</Button></form>}
  </article>;
}
function InboxPage() {
  const { isSignedIn } = useAuth();
  const inbox = useListMyContactRequests({ query: { enabled: isSignedIn, queryKey: getListMyContactRequestsQueryKey() } });
  const profile = useGetMyDonorProfile({ query: { enabled: isSignedIn, queryKey: getGetMyDonorProfileQueryKey() } });
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function decide(id: string, status: 'accepted' | 'declined', sharePhone: boolean) {
    setBusy(id); setError('');
    try { await decideContactRequest(id, { status, sharePhone }); await queryClient.invalidateQueries({ queryKey: getListMyContactRequestsQueryKey() }); }
    catch { setError('Your decision could not be saved. Please try again.'); } finally { setBusy(''); }
  }
  if (!isSignedIn) return <main className="page-wrap"><PageHeading eyebrow="Your connections" title="Contact inbox" description="Decide who can reach you, one request at a time." /><AuthPrompt /></main>;
  return <main className="page-wrap"><PageHeading eyebrow="Your connections" title="Contact inbox" description="Decide who can reach you, one request at a time." />
    {inbox.isLoading ? <SkeletonRows /> : inbox.isError ? <StatePanel title="Your inbox couldn't load" body="Please try again in a moment." error retry={() => queryClient.invalidateQueries({ queryKey: getListMyContactRequestsQueryKey() })} /> : !inbox.data?.length ? <StatePanel title="Your inbox is quiet" body="New contact requests will appear here. Your number stays private until you accept and choose to share it." /> : <div className="inbox-list">{inbox.data.map(item => <article className="inbox-card surface" key={item.id}><div className="inbox-card-top"><div className="requester-avatar">{item.requesterName.slice(0,1).toUpperCase()}</div><div><h3>{item.requesterName}</h3><span>{new Date(item.createdAt).toLocaleString()}</span></div><span className={`inbox-status ${item.status}`}>{item.status}</span></div><p className="inbox-message">{item.message}</p>{item.status === 'pending' ? <><div className="private-label"><LockKeyhole size={14} /> Their contact is only shown once you accept.</div><div className="inbox-actions"><Button variant="outline" disabled={busy === item.id} onClick={() => decide(item.id, 'declined', false)}><X size={15} /> Decline</Button><Button disabled={busy === item.id} onClick={() => decide(item.id, 'accepted', profile.data?.shareContact ?? false)}><Check size={15} /> {profile.data?.shareContact ? 'Accept & share phone' : 'Accept request'}</Button>{profile.data?.shareContact && <button className="text-link" disabled={busy === item.id} onClick={() => decide(item.id, 'accepted', false)}>Accept without sharing</button>}</div></> : item.status === 'accepted' ? <div className="consented-contact"><Phone size={15} /> Accepted request · contact sharing {item.sharePhone ? 'approved' : 'not shared'} <a href={`tel:${item.requesterPhone}`}>{item.requesterPhone}</a></div> : <p className="muted">You declined this request.</p>}</article>)}</div>}{error && <p className="form-error">{error}</p>}</main>;
}
function SafetyPage() {
  const { isSignedIn } = useAuth();
  const blocked = useListBlockedDonors({ query: { enabled: isSignedIn, queryKey: getListBlockedDonorsQueryKey() } });
  const qc = useQueryClient();
  const [error, setError] = useState('');
  async function unblock(id: string) { try { await unblockDonor(id); await qc.invalidateQueries({ queryKey: getListBlockedDonorsQueryKey() }); } catch { setError('Could not unblock this donor. Please retry.'); } }
  async function submitBlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    try { await blockDonor({ donorId: String(form.get('donorId')) }); await qc.invalidateQueries({ queryKey: getListBlockedDonorsQueryKey() }); e.currentTarget.reset(); }
    catch { setError('This donor could not be blocked. Check the donor ID and try again.'); }
  }
  const [reportForm, setReportForm] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try { await createReport({ subjectType: String(f.get('subjectType')) as 'donor' | 'blood_request' | 'blood_bank', subjectId: String(f.get('subjectId')), reason: String(f.get('reason')) as 'incorrect_information' | 'abuse' | 'fraud' | 'safety_concern' | 'other', details: String(f.get('details')) }); setReportDone(true); setReportForm(false); }
    catch { setError('Your report could not be submitted. Please try again.'); }
  }
  if (!isSignedIn) return <main className="page-wrap"><PageHeading eyebrow="Your safety" title="Safety & privacy" description="Tools to keep your RaktSetu experience in your hands." /><AuthPrompt /></main>;
  return <main className="page-wrap"><PageHeading eyebrow="Your safety" title="Safety & privacy" description="Tools to keep your RaktSetu experience in your hands." />
    <div className="safety-layout"><section className="surface safety-card"><div className="safety-heading"><span className="step-icon"><Ban size={19} /></span><div><h3>Blocked donors</h3><p>Donors you block will not be able to contact you.</p></div></div>{blocked.isLoading ? <SkeletonRows /> : blocked.isError ? <StatePanel title="Blocked list unavailable" body="Please try again." error /> : blocked.data?.length ? <div className="blocked-list">{blocked.data.map(d => <div className="blocked-row" key={d.donorId}><div className="requester-avatar">{d.displayName.slice(0,1)}</div><div><strong>{d.displayName}</strong><small>Blocked {new Date(d.createdAt).toLocaleDateString()}</small></div><Button variant="outline" onClick={() => unblock(d.donorId)}>Unblock</Button></div>)}</div> : <div className="inline-empty">No one is blocked. Your connections remain in your control.</div>}<form className="block-form" onSubmit={submitBlock}><Field label="Block a donor by profile ID"><input name="donorId" required placeholder="Donor profile ID" /></Field><Button variant="outline"><Ban size={14} /> Block donor</Button></form></section>
    <section className="surface safety-card"><div className="safety-heading"><span className="step-icon"><Flag size={19} /></span><div><h3>Report a concern</h3><p>Let our moderation team know about unsafe or inaccurate content.</p></div></div>{reportDone ? <p className="form-success">Report sent. Thank you for helping keep the community safe.</p> : !reportForm ? <Button variant="outline" onClick={() => setReportForm(true)}>Make a report <ArrowRight size={15} /></Button> : <form className="contact-form" onSubmit={submitReport}><Field label="What are you reporting?"><select name="subjectType"><option value="donor">A donor</option><option value="blood_request">A blood request</option><option value="blood_bank">A blood bank</option></select></Field><Field label="Reference ID"><input name="subjectId" required placeholder="ID of the profile or listing" /></Field><Field label="Reason"><select name="reason"><option value="safety_concern">Safety concern</option><option value="incorrect_information">Incorrect information</option><option value="abuse">Abuse</option><option value="fraud">Fraud</option><option value="other">Other</option></select></Field><Field label="Details"><textarea name="details" required minLength={4} maxLength={1000} placeholder="Tell us what happened" /></Field><div className="inbox-actions"><Button>Submit report</Button><Button type="button" variant="outline" onClick={() => setReportForm(false)}>Cancel</Button></div></form>}</section></div>{error && <p className="form-error">{error}</p>}
    <aside className="safety-note"><ShieldCheck size={20} /><div><strong>Private by design</strong><p>RaktSetu never lists donor phone numbers publicly. Sharing is a deliberate, request-by-request choice.</p></div></aside></main>;
}
function AdminPage() {
  const { isSignedIn } = useAuth();
  const overview = useGetAdminOverview({ query: { enabled: isSignedIn, queryKey: getGetAdminOverviewQueryKey(), retry: false } });
  const reports = useListAdminReports({ status: 'open' }, { query: { enabled: isSignedIn && overview.isSuccess, queryKey: getListAdminReportsQueryKey({ status: 'open' }), retry: false } });
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function updateReport(id: string, status: 'reviewed' | 'dismissed') { setBusy(id); try { await updateAdminReport(id, { status }); await qc.invalidateQueries({ queryKey: getListAdminReportsQueryKey({ status: 'open' }) }); await qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); } catch { setError('Could not update report status.'); } finally { setBusy(''); } }
  if (!isSignedIn) return <main className="page-wrap"><PageHeading eyebrow="Restricted access" title="Moderation" description="This workspace is restricted to verified RaktSetu administrators." /><AuthPrompt /></main>;
  if (overview.isLoading) return <main className="page-wrap"><PageHeading eyebrow="Moderation" title="Admin dashboard" description="Loading secure moderation overview." /><SkeletonRows /></main>;
  if (overview.isError || !overview.data) return <main className="page-wrap"><PageHeading eyebrow="Restricted access" title="Admin dashboard" description="This area is available only to verified administrators." /><StatePanel title="Access not available" body="Your account does not have moderation access, or the service is temporarily unavailable." error retry={() => qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() })} /></main>;
  const data = overview.data;
  return <main className="page-wrap"><PageHeading eyebrow="Verified administrator" title="Moderation desk" description="Review community health and keep connections trustworthy." />
    <section className="admin-stats">{[{label:'Registered donors',value:data.donorCount,icon:Users},{label:'Available now',value:data.availableDonorCount,icon:HeartHandshake},{label:'Active requests',value:data.activeRequestCount,icon:Activity},{label:'Open reports',value:data.openReportCount,icon:Flag}].map(s => <article key={s.label} className="admin-stat surface"><s.icon size={19} /><span>{s.label}</span><strong>{s.value}</strong></article>)}</section>
    <section className="admin-columns"><div className="surface admin-panel"><div className="panel-heading"><div><h3>Open reports</h3><p>Review reports submitted by community members.</p></div><span className="count-badge">{data.openReportCount}</span></div>{reports.isLoading ? <SkeletonRows /> : reports.isError ? <StatePanel title="Reports unavailable" body="Please retry." error /> : !reports.data?.length ? <div className="inline-empty">No open reports. The community is looking good.</div> : reports.data.map(r => <article className="report-row" key={r.id}><div className="report-row-top"><span className="report-type">{r.subjectType.replace('_',' ')}</span><span>{new Date(r.createdAt).toLocaleDateString()}</span></div><h4>{r.reason.replace('_',' ')}</h4><p>{r.details}</p><small>Reference: {r.subjectId}</small><div className="report-actions"><Button variant="outline" disabled={busy === r.id} onClick={() => updateReport(r.id, 'dismissed')}>Dismiss</Button><Button disabled={busy === r.id} onClick={() => updateReport(r.id, 'reviewed')}>Mark reviewed</Button></div></article>)}</div>
    <div className="surface admin-panel"><div className="panel-heading"><div><h3>Recent requests</h3><p>Active requests across the community.</p></div></div>{data.recentRequests.length ? data.recentRequests.map(r => <div className="admin-request" key={r.id}><span className="blood-chip">{r.bloodGroup}</span><div><strong>{r.hospital}</strong><small>{r.area}, {r.city} · {r.status}</small></div><span className={`urgency-tag ${r.urgency}`}>{r.urgency}</span></div>) : <div className="inline-empty">No recent requests.</div>}</div></section>{error && <p className="form-error">{error}</p>}
  </main>;
}
function SignInPage() { return <main className="auth-page"><div className="auth-side"><Brand light /><div><div className="eyebrow eyebrow-light">A kinder way to connect</div><h1>Good people,<br />closer together.</h1><p>When the moment matters, trust should come first.</p></div><small>RaktSetu · A community for care</small></div><div className="auth-content"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></main>; }
function SignUpPage() { return <main className="auth-page"><div className="auth-side"><Brand light /><div><div className="eyebrow eyebrow-light">Join the community</div><h1>Your choice to help<br />can change a day.</h1><p>Set up your account, then choose exactly how you connect.</p></div><small>RaktSetu · A community for care</small></div><div className="auth-content"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></main>; }

const appearance = {
  theme: shadcn, cssLayerName: 'clerk' as const,
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#b51d37', colorForeground: '#342326', colorMutedForeground: '#78686b', colorDanger: '#b51d37', colorBackground: '#fffdfa', colorInput: '#fffdfa', colorInputForeground: '#342326', colorNeutral: '#e8dcda', fontFamily: 'DM Sans', borderRadius: '0.75rem' },
  elements: { rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffdfa] rounded-2xl w-[440px] max-w-full overflow-hidden', card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none', headerTitle: 'text-[#342326] font-bold', headerSubtitle: 'text-[#78686b]', socialButtonsBlockButtonText: 'text-[#342326]', formFieldLabel: 'text-[#342326]', footerActionLink: 'text-[#a91e37]', footerActionText: 'text-[#78686b]', dividerText: 'text-[#78686b]', identityPreviewEditButton: 'text-[#a91e37]', formFieldSuccessText: 'text-[#326b58]', alertText: 'text-[#342326]', logoBox: 'rounded-xl', logoImage: 'object-contain', socialButtonsBlockButton: 'border-[#e8dcda] bg-white', formButtonPrimary: 'bg-[#b51d37] hover:bg-[#99152d]', formFieldInput: 'border-[#e8dcda] bg-white text-[#342326]', footerAction: 'border-0', dividerLine: 'bg-[#e8dcda]', alert: 'bg-[#fff1ed]', otpCodeFieldInput: 'border-[#e8dcda] bg-white', formFieldRow: 'gap-2', main: 'gap-4' },
};
function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  useEffect(() => { let prior: string | null | undefined; return addListener(({ user }) => { const id = user?.id ?? null; if (prior !== undefined && prior !== id) qc.clear(); prior = id; }); }, [addListener, qc]);
  return null;
}
function Routes() {
  const [, setLocation] = useLocation();
  return <><ClerkCacheInvalidator /><Switch>
    <Route path="/" component={() => <Layout><Home /></Layout>} />
    <Route path="/register-donor" component={() => <Layout><RegisterPage /></Layout>} />
    <Route path="/profile" component={() => <Layout><ProfilePage /></Layout>} />
    <Route path="/banks" component={() => <Layout><BanksPage /></Layout>} />
    <Route path="/request" component={() => <Layout><RequestPage /></Layout>} />
    <Route path="/track" component={() => <Layout><TrackPage /></Layout>} />
    <Route path="/inbox" component={() => <Layout><InboxPage /></Layout>} />
    <Route path="/requests" component={() => <Layout><RequestsPage /></Layout>} />
    <Route path="/safety" component={() => <Layout><SafetyPage /></Layout>} />
    <Route path="/admin" component={() => <Layout><AdminPage /></Layout>} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route component={NotFound} />
  </Switch></>;
}
function ClerkApp() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to connect with your community' } }, signUp: { start: { title: 'Join RaktSetu', subtitle: 'Create an account to offer or request help' } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}><Routes /></ClerkProvider>;
}
function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkApp /></WouterRouter></QueryClientProvider>;
}
export default App;
