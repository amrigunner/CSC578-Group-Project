import { supabase } from './supabaseClient';
import { useState, useEffect, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import uitmLogo from './assets/UiTM-Logo-tumb.png';

// =============================================================
// CONFIGURATION: ALLOWED ADMINISTRATOR ACCOUNTS
// =============================================================
const ADMIN_EMAILS = [
  'amrigunner@gmail.com',
  'admin@uitm.edu.my'
];

// Helper to convert internal ISO string (YYYY-MM-DD) to Display Format (DD/MM/YYYY)
const formatToDisplayDate = ( isoDateStr ) => {
  if (!isoDateStr || !isoDateStr.includes('-')) return isoDateStr;
  const [year, month, day] = isoDateStr.split('-');
  return `${day}/${month}/${year}`;
};

// FIGMA-INSPIRED PREMIUM DESIGN POPUPS/MODALS
function PremiumDialogModal({ isOpen, type, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  const isActionPrompt = type === 'prompt';
  const isSuccessType = type === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl border border-gray-100 flex flex-col items-center space-y-4">
        {isSuccessType ? (
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl font-bold">
            ✓
          </div>
        ) : (
          <div className="w-14 h-14 bg-purple-50 text-purple-900 rounded-full flex items-center justify-center text-xl">
            i
          </div>
        )}
        <h3 className="text-sm font-black text-purple-950 uppercase tracking-wide break-words w-full">{title}</h3>
        <p className="text-xs text-gray-600 leading-relaxed max-w-xs break-words w-full">{message}</p>
        <div className="w-full pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          {isActionPrompt ? (
            <>
              <button
                onClick={onConfirm}
                className="w-full sm:w-auto min-w-[100px] px-5 py-2 bg-purple-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Yes
              </button>
              <button
                onClick={onCancel}
                className="w-full sm:w-auto min-w-[100px] px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={onConfirm || onCancel}
              className="w-full sm:w-auto min-w-[140px] px-6 py-2 bg-purple-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [adminSubView, setAdminSubView] = useState('analytics');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 'n1', title: 'System Initialized', description: 'Connected safely to Supabase backend cluster pipeline.', timestamp: 'Just Now', unread: true }
  ]);
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Registration Form States
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: '', idNumber: '', email: '' });
  const [eventForm, setEventForm] = useState({ title: '', organizer: '', location: '', date: '', startTime: '', endTime: '', category: 'Event', content: '', image: null });
  const [annForm, setAnnForm] = useState({ title: '', category: 'General', publishedOn: '', content: '', image: null });

  const [editingEventId, setEditingEventId] = useState(null);
  const [editEventData, setEditEventData] = useState({ title: '', organizer: '', location: '', date: '', startTime: '', endTime: '', category: 'Event', content: '', image: null });
  const [editingAnnId, setEditingAnnId] = useState(null);
  const [editAnnData, setEditAnnData] = useState({ title: '', category: 'General', date: '', content: '', image: null });

  const [activeDetails, setActiveDetails] = useState(null);
  const [dialogState, setDialogState] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: null });

  useEffect(() => {
    const fetchCloudData = async () => {
      try {
        const { data: cloudEvents, error: errEvents } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: true });
        if (errEvents) throw errEvents;
        setEvents(cloudEvents || []);

        const { data: cloudAnns, error: errAnns } = await supabase
          .from('announcements')
          .select('*')
          .order('id', { ascending: false });
        if (errAnns) throw errAnns;
        setAnnouncements(cloudAnns || []);

        const { data: cloudRequests, error: errRequests } = await supabase
          .from('pending_requests')
          .select('*')
          .order('id', { ascending: false });
        if (errRequests) throw errRequests;
        setPendingRequests(cloudRequests || []);
      } catch (error) {
        console.error("Supabase initial handshake exception:", error.message);
        pushNotification('Sync Failure', 'Could not read live records cleanly from database tables.');
      }
    };
    fetchCloudData();
  }, []);

  const pushNotification = ( title, description ) => {
    const newNotif = {
      id: `notif_${Date.now()}`,
      title,
      description,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: true
    };
    setNotifications( prev => [newNotif, ...prev]);
  };

  const triggerModal = ( type, title, message, onConfirm = null) => {
    setDialogState({ isOpen: true, type, title, message, onConfirm });
  };

  const closeModal = () => {
    setDialogState( prev => ({ ...prev, isOpen: false }));
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async ( tokenResponse ) => {
      setAccessToken(tokenResponse.access_token);
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        });
        const payload = await userInfoRes.json();
        const email = payload.email.toLowerCase();
        const name = payload.name || 'UiTM User';

        setUserProfile({ name, email });

        if (ADMIN_EMAILS.map( e => e.toLowerCase()).includes(email)) {
          setUserRole('admin');
          setCurrentView('admin_dashboard');
          triggerModal('success', 'ACCESS GRANTED!', `Admin suite authorization verified successfully. Welcome back, ${name}.`);
          pushNotification('Admin Authorized', `Administrator context initialized cleanly for ${name}.`);
        } else {
          setUserRole('user');
          setCurrentView('home');
          triggerModal('success', 'Welcome Back!', `Logged in successfully as ${name}.`);
          pushNotification('Login Success', `Successfully signed in as ${name}.`);
        }
      } catch (err) {
        triggerModal('info', 'Auth Exception', 'Google identity framework returned verification issues.');
      }
    },
    onError: () => triggerModal('info', 'OAuth Failure', 'Google secure token handshake failed.'),
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
  });

  const syncEventToGoogleCalendar = async ( targetEvent ) => {
    if (!accessToken) return false;
    try {
      const gcalEvent = {
        summary: targetEvent.title,
        location: targetEvent.location,
        description: `${targetEvent.content || ""}\n\nOrganized by: ${targetEvent.organizer}`,
        start: { dateTime: `${targetEvent.date}T${targetEvent.startTime || '09:00'}:00`, timeZone: 'Asia/Kuala_Lumpur' },
        end: { dateTime: `${targetEvent.date}T${targetEvent.endTime || '17:00'}:00`, timeZone: 'Asia/Kuala_Lumpur' }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(gcalEvent)
      });
      return response.ok;
    } catch (error) {
      console.error("Google Calendar Sync Exception:", error);
      return false;
    }
  };

  const handleStudentRegistration = async ( e ) => {
    e.preventDefault();
    if (!accessToken) {
      triggerModal('info', 'Authentication Required', 'Please connect with your Google profile first to sync events to your Google Calendar.');
      return;
    }
    if (!activeDetails) return;
    setIsRegistering(true);
    try {
      const { error: dbErr } = await supabase
        .from('event_registrations')
        .insert([
          {
            event_id: activeDetails.id,
            student_name: studentForm.name,
            student_id_number: studentForm.idNumber,
            student_email: studentForm.email
          }
        ]);

      if (dbErr) {
        if (dbErr.code === '23505') {
          throw new Error("You have already submitted a seat registration for this event pipeline!");
        }
        throw dbErr;
      }

      const calendarSyncSuccessful = await syncEventToGoogleCalendar(activeDetails);
      if (calendarSyncSuccessful) {
        triggerModal('success', 'Registration Confirmed!', `Seat successfully secured for "${activeDetails.title}". Event structure has been synced to your Google Calendar context seamlessly.`);
        pushNotification('Event Registered', `Successfully booked slot & calendar space for: ${activeDetails.title}`);
      } else {
        triggerModal('success', 'Registration Completed with Warnings', `Seat booked successfully inside database. However, Google Workspace sync was skipped or identity context expired.`);
        pushNotification('Event Registered', `Database slot confirmed but failed Calendar API sync for: ${activeDetails.title}`);
      }

      setShowRegisterForm(false);
      setActiveDetails(null);
      setStudentForm({ name: '', idNumber: '', email: '' });
    } catch (err) {
      triggerModal('info', 'Registration Conflict', err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = () => {
    setUserProfile(null);
    setUserRole(null);
    setAccessToken(null);
    setCurrentView('home');
    pushNotification('Logged Out', 'Your profile session has ended safely.');
  };

  const handleDeleteEvent = async ( id, e ) => {
    if (e) e.stopPropagation();
    triggerModal('prompt', 'Confirm Deletion', 'Are you sure you want to permanently remove this event from live database records?', async () => {
      try {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
        setEvents( prev => prev.filter( e => e.id !== id));
        triggerModal('success', 'Notice Removed', 'Event structure deleted from live database records.');
        pushNotification('Event Removed', 'An item was removed from system database files securely.');
      } catch (err) {
        triggerModal('info', 'Database Error', err.message);
      }
    });
  };

  const handleDeleteAnnouncement = async ( id, e ) => {
    if (e) e.stopPropagation();
    triggerModal('prompt', 'Confirm Deletion', 'Are you sure you want to completely erase this notice board post from database storage?', async () => {
      try {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;
        setAnnouncements( prev => prev.filter( a => a.id !== id));
        triggerModal('success', 'Notice Cleaned', 'The specified system notice has been completely wiped from database storage.');
        pushNotification('Announcement Wiped', 'Notice board post deleted by administration.');
      } catch (err) {
        triggerModal('info', 'Database Error', err.message);
      }
    });
  };

  const startEditingEvent = ( event, e ) => {
    if (e) e.stopPropagation();
    setEditingEventId(event.id);
    setEditEventData({ ...event });
  };

  const saveUpdatedEvent = async ( e ) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('events')
        .update({
          title: editEventData.title,
          organizer: editEventData.organizer,
          location: editEventData.location,
          date: editEventData.date,
          startTime: editEventData.startTime,
          endTime: editEventData.endTime,
          category: editEventData.category,
          content: editEventData.content,
          image: editEventData.image
        })
        .eq('id', editingEventId);

      if (error) throw error;
      setEvents( prev => prev.map( ev => ev.id === editingEventId ? editEventData : ev));
      setEditingEventId(null);
      triggerModal('success', 'Records Updated', 'Event changes permanently synchronized with backend cloud cluster.');
      pushNotification('Event Updated', `"${editEventData.title}" modifications saved securely.`);
    } catch (err) {
      triggerModal('info', 'Update Error', err.message);
    }
  };

  const startEditingAnn = ( ann, e ) => {
    if (e) e.stopPropagation();
    setEditingAnnId(ann.id);
    setEditAnnData({ ...ann });
  };

  const saveUpdatedAnn = async ( e ) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          title: editAnnData.title,
          category: editAnnData.category,
          content: editAnnData.content,
          date: editAnnData.date,
          image: editAnnData.image
        })
        .eq('id', editingAnnId);

      if (error) throw error;
      setAnnouncements( prev => prev.map( an => an.id === editingAnnId ? editAnnData : an));
      setEditingAnnId(null);
      triggerModal('success', 'Notices Updated', 'Announcement adjustments permanently stored inside cloud table.');
      pushNotification('Notice Updated', `"${editAnnData.title}" text refreshed.`);
    } catch (err) {
      triggerModal('info', 'Update Error', err.message);
    }
  };

  const processImageFile = ( file, callback ) => {
    const reader = new FileReader();
    reader.onloadend = () => callback(reader.result);
    if (file) reader.readAsDataURL(file);
  };

  const handleEventFormSubmit = async ( e ) => {
    e.preventDefault();
    const pendingPayload = {
      title: eventForm.title,
      organizer: eventForm.organizer,
      location: eventForm.location,
      date: eventForm.date,
      startTime: eventForm.startTime,
      endTime: eventForm.endTime,
      category: eventForm.category,
      content: eventForm.content,
      image: eventForm.image
    };

    try {
      const { data, error } = await supabase
        .from('pending_requests')
        .insert([pendingPayload])
        .select();

      if (error) throw error;
      if (data && data.length > 0) {
        setPendingRequests( prev => [data[0], ...prev]);
      }
      setEventForm({ title: '', organizer: '', location: '', date: '', startTime: '', endTime: '', category: 'Event', content: '', image: null });
      setCurrentView('home');
      triggerModal('success', 'Submission Successful!', 'Your proposal has been securely logged into the remote database review table queue.');
      pushNotification('Proposal Forwarded', `"${pendingPayload.title}" uploaded to admin queue successfully.`);
    } catch (err) {
      triggerModal('info', 'Submission Error', err.message);
    }
  };

  const handleApproveRequest = ( id, e ) => {
    if (e) e.stopPropagation();
    const target = pendingRequests.find( r => r.id === id);
    if (!target) return;

    triggerModal('prompt', 'Approve Event?', `Are you sure you want to approve "${target.title}"?`, async () => {
      try {
        const { data: approvedRow, error: errInsert } = await supabase
          .from('events')
          .insert([{
            title: target.title,
            organizer: target.organizer,
            location: target.location,
            date: target.date,
            startTime: target.startTime,
            endTime: target.endTime,
            category: target.category,
            content: target.content,
            image: target.image
          }])
          .select();

        if (errInsert) throw errInsert;
        const { error: errDel } = await supabase.from('pending_requests').delete().eq('id', id);
        if (errDel) throw errDel;

        if (approvedRow && approvedRow.length > 0) {
          setEvents( prev => [...prev, approvedRow[0]]);
        }
        setPendingRequests( prev => prev.filter( r => r.id !== id));

        const syncOk = await syncEventToGoogleCalendar(target);
        if (syncOk) {
          triggerModal('success', 'Approved & Synced!', 'Authorized into Supabase storage and pushed live on connected Google Calendar accounts.');
          pushNotification('Event Approved', `"${target.title}" committed live.`);
        } else {
          triggerModal('success', 'Approved Cloud DB', 'Saved to remote cloud tables perfectly, Google workspace synchronization skipped.');
          pushNotification('Event Approved', `"${target.title}" written to cloud database.`);
        }
      } catch (err) {
        triggerModal('info', 'Database Error', err.message);
      }
    });
  };

  const handleRejectRequest = ( id, e ) => {
    if (e) e.stopPropagation();
    const target = pendingRequests.find( r => r.id === id);
    const titleText = target ? `"${target.title}"` : "this request";

    triggerModal('prompt', 'Reject Event?', `Are you absolutely certain you want to decline ${titleText}?`, async () => {
      try {
        const { error } = await supabase.from('pending_requests').delete().eq('id', id);
        if (error) throw error;
        setPendingRequests( prev => prev.filter( r => r.id !== id));
        triggerModal('success', 'Application Declined', 'The request pipeline has been safely deleted from storage records.');
        pushNotification('Proposal Denied', 'An event layout model request entry was declined.');
      } catch (err) {
        triggerModal('info', 'Database Error', err.message);
      }
    });
  };

  const handleAnnSubmit = async ( e ) => {
    e.preventDefault();
    const displayDate = annForm.publishedOn || new Date().toISOString().split('T')[0];
    const annPayload = {
      title: annForm.title,
      category: annForm.category || 'General',
      content: annForm.content,
      date: displayDate,
      image: annForm.image
    };

    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert([annPayload])
        .select();

      if (error) throw error;
      if (data && data.length > 0) {
        setAnnouncements( prev => [data[0], ...prev]);
      }
      setAnnForm({ title: '', category: 'General', publishedOn: '', content: '', image: null });
      triggerModal('success', 'Notice Broadcasted!', 'Your announcement has been safely appended inside the Supabase cloud table layer.');
      pushNotification('New Announcement', `Notice: "${annPayload.title}" posted.`);
    } catch (err) {
      triggerModal('info', 'Database Error', err.message);
    }
  };

  const handleFooterLinkClick = ( type ) => {
    const infoMap = {
      motto: { title: "Motto & Vision", content: "Motto: Usaha, Taqwa, Mulia.\n\nVision: To establish UiTM as a globally renowned university in science, technology, humanities, and entrepreneurship." },
      faq: { title: "Help / FAQ", content: "Q: How do I submit campus event requests?\nA: Sign in with your student account and click the 'Submit Event' tab.\n\nQ: Does data save automatically?\nA: Yes! All creations are connected to live tables instantly." },
      history: { title: "Historical Development", content: "Established in 1956 as RIDA Training Centre, evolving into ITM in 1967, and officially elevated to Universiti Teknologi MARA (UiTM) in 1999." },
      privacy: { title: "Privacy Policy", content: "UiTM Event Portal strictly honors identity safety. Cloud data handling uses encrypted communication parameters directly." },
      portal: { title: "UiTM Official Portal", content: "Main Domain Presence: https://www.uitm.edu.my\n\nAccess your student directories, fees, and academic records directly." },
      support: { title: "Campus Support Email", content: "Need technical assistance?\n\nReach out to campus logistics administration at: support@uitm.edu.my." }
    };
    if (infoMap[type]) {
      setActiveDetails({ title: infoMap[type].title, content: infoMap[type].content, type: 'footer_info' });
    }
  };

  const markAllAsRead = () => setNotifications( prev => prev.map( n => ({ ...n, unread: false })));
  const clearAllNotifications = () => setNotifications([]);
  
  const unreadCount = notifications.filter( n => n.unread).length;
  const categoryOptions = ['All', 'General', 'Academic', 'Event', 'Urgent'];
  
  const filteredAnnouncements = selectedCategory === 'All'
    ? announcements
    : announcements.filter( a => (a.category || 'General').toLowerCase() === selectedCategory.toLowerCase());

  const filteredEvents = selectedCategory === 'All'
    ? events
    : events.filter( e => (e.category || 'Event').toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-gray-800 overflow-x-hidden w-full">
      <div className="bg-purple-950 text-white text-center py-2.5 px-4 text-xs font-medium tracking-wide break-words">
        Event Management with Notification
      </div>
      
      <header className="bg-white border-b border-gray-100 relative pt-6 pb-4 w-full">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center relative gap-4 sm:gap-0">
          <div className="flex flex-col items-center text-center cursor-pointer" onClick={() => setCurrentView('home')}>
            <img src={uitmLogo} alt="UiTM Official Crest" className="h-16 w-auto object-contain mb-2" />
          </div>
          
          <div className="static sm:absolute sm:right-4 sm:top-4 text-xs z-20 flex flex-wrap justify-center items-center gap-3 w-full sm:w-auto">
            <button onClick={() => { setIsNotifOpen(true); markAllAsRead(); }} className="relative p-2 text-gray-600 hover:text-purple-950 hover:bg-gray-100 rounded-full transition-all cursor-pointer shrink-0" title="Notification Log Feed">
              <span className="text-lg"> 🔔 </span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {userProfile ? (
              <div className="flex flex-wrap justify-center items-center gap-2">
                <div className="bg-purple-950 text-white font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm max-w-[180px] sm:max-w-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span className="text-[10px] capitalize truncate">[{userRole}] {userProfile.name.split(' ')[0]}</span>
                </div>
                {userRole === 'user' && (
                  <button onClick={() => setCurrentView('submit_event')} className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-[10px] whitespace-nowrap"> Submit Event</button>
                )}
                <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-[10px] whitespace-nowrap">Logout</button>
              </div>
            ) : (
              <button onClick={() => loginWithGoogle()} className="bg-purple-950 hover:bg-black text-white px-4 py-2 rounded-xl font-bold transition-all cursor-pointer shadow-md tracking-wide text-[11px] sm:text-xs text-center">
                Sign In with Google Account
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 overflow-x-hidden">
        {/* VIEW: SUBMIT NEW PROPOSAL */}
        {currentView === 'submit_event' && (
          <div className="max-w-2xl mx-auto bg-white border rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-xs sm:text-sm font-black text-purple-950 uppercase tracking-wider truncate mr-2">Propose New Campus Event</h2>
              <button onClick={() => setCurrentView('home')} className="text-gray-400 font-bold text-xs shrink-0">Back</button>
            </div>
            <form onSubmit={handleEventFormSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">EVENT TITLE</label>
                  <input type="text" required className="w-full p-2.5 border rounded-xl" value={eventForm.title} onChange={ e => setEventForm({ ...eventForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">ORGANIZER GROUP</label>
                  <input type="text" required className="w-full p-2.5 border rounded-xl" value={eventForm.organizer} onChange={ e => setEventForm({ ...eventForm, organizer: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">LOCATION / VENUE</label>
                  <input type="text" required className="w-full p-2.5 border rounded-xl" value={eventForm.location} onChange={ e => setEventForm({ ...eventForm, location: e.target.value })} />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">DATE</label>
                  <input type="date" required className="w-full p-2.5 border rounded-xl bg-white text-gray-700 cursor-pointer" value={eventForm.date} onChange={ e => setEventForm({ ...eventForm, date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">START TIME</label>
                  <input type="time" required className="w-full p-2.5 border rounded-xl" value={eventForm.startTime} onChange={ e => setEventForm({ ...eventForm, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">END TIME</label>
                  <input type="time" required className="w-full p-2.5 border rounded-xl" value={eventForm.endTime} onChange={ e => setEventForm({ ...eventForm, endTime: e.target.value })} />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">CATEGORY FLAG</label>
                  <select className="w-full p-2.5 border rounded-xl bg-white" value={eventForm.category} onChange={ e => setEventForm({ ...eventForm, category: e.target.value })}>
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Event">Event</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">COVER BANNER IMAGE</label>
                <input type="file" accept="image/*" className="w-full p-2 border border-dashed rounded-xl" onChange={ e => processImageFile(e.target.files[0], base64 => setEventForm({ ...eventForm, image: base64 }))} />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">PROPOSAL SYNOPSIS & CONTENT</label>
                <textarea required rows="4" placeholder="Elaborate details..." className="w-full p-2.5 border rounded-xl bg-gray-50/50" value={eventForm.content} onChange={ e => setEventForm({ ...eventForm, content: e.target.value })} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
                <button type="button" onClick={() => setCurrentView('home')} className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer order-2 sm:order-1">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-purple-950 hover:bg-black text-white font-bold rounded-xl cursor-pointer transition-all order-1 sm:order-2">Submit to Review Pipeline</button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW: MAIN HOME / CATEGORIES GRID DASHBOARD */}
        {(currentView === 'home' || currentView === 'admin_dashboard') && (
          <div className="space-y-6">
            {/* Category selection header pills */}
            <div className="flex flex-wrap items-center gap-1.5 border-b pb-4 border-gray-100">
              <span className="text-[11px] uppercase font-black text-purple-950 mr-2 tracking-wider w-full sm:w-auto mb-1 sm:mb-0">Classification filter:</span>
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                {categoryOptions.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${selectedCategory === cat ? 'bg-purple-950 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Split view handling logic blocks for User vs Admin view modes */}
            {userRole === 'admin' && currentView === 'admin_dashboard' && (
              <div className="space-y-6">
                <div className="bg-purple-50 rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row flex-wrap gap-2 border border-purple-100 shadow-xs">
                  <button onClick={() => setAdminSubView('analytics')} className={`px-4 py-2 rounded-xl text-left sm:text-center text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${adminSubView === 'analytics' ? 'bg-purple-950 text-white' : 'text-purple-950 hover:bg-purple-100'}`}>📈 System Operations Overview</button>
                  <button onClick={() => setAdminSubView('proposals_queue')} className={`px-4 py-2 rounded-xl text-left sm:text-center text-xs font-black uppercase tracking-wider transition-all cursor-pointer relative ${adminSubView === 'proposals_queue' ? 'bg-purple-950 text-white' : 'text-purple-950 hover:bg-purple-100'}`}>
                    📥 Pending Requests Pipeline
                    {pendingRequests.length > 0 && <span className="ml-1.5 bg-red-500 text-white font-bold px-1.5 py-0.5 text-[9px] rounded-full">{pendingRequests.length}</span>}
                  </button>
                  <button onClick={() => setAdminSubView('broadcast_man')} className={`px-4 py-2 rounded-xl text-left sm:text-center text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${adminSubView === 'broadcast_man' ? 'bg-purple-950 text-white' : 'text-purple-950 hover:bg-purple-100'}`}>📢 Broadcast Notice Board Writer</button>
                </div>

                {/* ADMIN SUB: ANALYTICS */}
                {adminSubView === 'analytics' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
                    <div className="bg-white border p-5 rounded-3xl shadow-xs text-center space-y-1">
                      <div className="text-2xl font-black text-purple-950">{events.length}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Live Active Campus Events</div>
                    </div>
                    <div className="bg-white border p-5 rounded-3xl shadow-xs text-center space-y-1">
                      <div className="text-2xl font-black text-amber-500">{pendingRequests.length}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Awaiting Verification Queue</div>
                    </div>
                    <div className="bg-white border p-5 rounded-3xl shadow-xs text-center space-y-1">
                      <div className="text-2xl font-black text-emerald-600">{announcements.length}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">System Broadcast Postings</div>
                    </div>
                  </div>
                )}

                {/* ADMIN SUB: PROPOSALS QUEUE */}
                {adminSubView === 'proposals_queue' && (
                  <div className="space-y-3 animate-fadeIn">
                    <h3 className="text-xs font-black uppercase text-purple-950 tracking-wider">Review Pipeline Records</h3>
                    {pendingRequests.length === 0 ? (
                      <div className="text-center p-8 border border-dashed rounded-3xl text-xs text-gray-400">No event models awaiting administrative clearance. All quiet!</div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {pendingRequests.map(req => (
                          <div key={req.id} className="bg-white border rounded-3xl p-4 flex flex-col justify-between shadow-xs">
                            <div className="space-y-2 w-full overflow-hidden">
                              <div className="flex justify-between items-start gap-2">
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">{req.category || 'Event'}</span>
                                <span className="text-gray-400 text-[10px] font-mono truncate">ID: {req.id}</span>
                              </div>
                              <h4 className="font-black text-purple-950 text-sm leading-tight break-words">{req.title}</h4>
                              <p className="text-[11px] text-gray-600 line-clamp-3 leading-relaxed break-words">{req.content}</p>
                              <div className="text-[10px] text-gray-500 grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 font-medium bg-gray-50 p-2 rounded-xl w-full">
                                <div className="truncate">📅 Date: {formatToDisplayDate(req.date)}</div>
                                <div className="truncate">📍 Venue: {req.location}</div>
                                <div className="truncate">🕒 Time: {req.startTime} - {req.endTime}</div>
                                <div className="truncate">👥 Group: {req.organizer}</div>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-3 mt-3 border-t border-gray-100 w-full">
                              <button onClick={(e) => handleRejectRequest(req.id, e)} className="w-full sm:w-auto px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-[11px] cursor-pointer transition-all order-2 sm:order-1">Decline Submission</button>
                              <button onClick={(e) => handleApproveRequest(req.id, e)} className="w-full sm:w-auto px-4 py-1.5 bg-purple-950 hover:bg-black text-white font-bold rounded-lg text-[11px] cursor-pointer transition-all shadow-xs order-1 sm:order-2">Clear & Approve Live</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ADMIN SUB: BROADCAST SYSTEM NOTICE BOARD WRITER */}
                {adminSubView === 'broadcast_man' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-white border rounded-3xl p-4 sm:p-5 shadow-sm">
                      {editingAnnId ? (
                        <form onSubmit={saveUpdatedAnn} className="space-y-3 text-xs">
                          <div className="flex justify-between items-center border-b pb-1.5 mb-2">
                            <h4 className="font-black text-purple-950 uppercase tracking-wider truncate mr-2">Modify Notice Row</h4>
                            <button type="button" onClick={() => setEditingAnnId(null)} className="text-gray-400 font-bold shrink-0">Cancel</button>
                          </div>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">NOTICE HEADER</label>
                            <input type="text" required className="w-full p-2 border rounded-xl bg-white" value={editAnnData.title} onChange={ e => setEditAnnData({ ...editAnnData, title: e.target.value })} />
                          </div>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">CLASSIFICATION FLAG</label>
                            <select className="w-full p-2 border rounded-xl bg-white" value={editAnnData.category} onChange={ e => setEditAnnData({ ...editAnnData, category: e.target.value })}>
                              <option value="General">General</option>
                              <option value="Academic">Academic</option>
                              <option value="Event">Event</option>
                              <option value="Urgent">Urgent</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">BROADCAST DATE</label>
                            <input type="date" required className="w-full p-2 border rounded-xl bg-white text-gray-700 cursor-pointer" value={editAnnData.date} onChange={ e => setEditAnnData({ ...editAnnData, date: e.target.value })} />
                          </div>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">NOTICE SYNOPSIS BODY</label>
                            <textarea required rows="4" className="w-full p-2 border rounded-xl bg-white" value={editAnnData.content} onChange={ e => setEditAnnData({ ...editAnnData, content: e.target.value })} />
                          </div>
                          <button type="submit" className="w-full py-2 bg-purple-950 text-white font-black rounded-xl hover:bg-black transition-all cursor-pointer shadow-md">Commit Record Alterations</button>
                        </form>
                      ) : (
                        <form onSubmit={handleAnnSubmit} className="space-y-3 text-xs">
                          <h4 className="font-black text-purple-950 uppercase tracking-wider border-b pb-1.5 mb-2">Create Global Notice</h4>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">NOTICE TITLE</label>
                            <input type="text" required placeholder="e.g. Server Maintenance Window" className="w-full p-2 border rounded-xl bg-white" value={annForm.title} onChange={ e => setAnnForm({ ...annForm, title: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block font-bold text-gray-700 mb-1">CATEGORY</label>
                              <select className="w-full p-2 border rounded-xl bg-white" value={annForm.category} onChange={ e => setAnnForm({ ...annForm, category: e.target.value })}>
                                <option value="General">General</option>
                                <option value="Academic">Academic</option>
                                <option value="Event">Event</option>
                                <option value="Urgent">Urgent</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold text-gray-700 mb-1">PUBLISHED DATE</label>
                              <input type="date" required className="w-full p-2 border rounded-xl bg-white text-gray-700 cursor-pointer" value={annForm.publishedOn} onChange={ e => setAnnForm({ ...annForm, publishedOn: e.target.value })} />
                            </div>
                          </div>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">BANNER ATTACHMENT (OPTIONAL)</label>
                            <input type="file" accept="image/*" className="w-full p-1.5 border border-dashed rounded-xl" onChange={ e => processImageFile(e.target.files[0], base64 => setAnnForm({ ...annForm, image: base64 }))} />
                          </div>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">NOTICE DETAILS CONTENT</label>
                            <textarea required rows="4" placeholder="Type notice brief here..." className="w-full p-2 border rounded-xl bg-gray-50/50" value={annForm.content} onChange={ e => setAnnForm({ ...annForm, content: e.target.value })} />
                          </div>
                          <button type="submit" className="w-full py-2 bg-purple-950 text-white font-black rounded-xl hover:bg-black transition-all cursor-pointer shadow-md">Broadcast Announcement</button>
                        </form>
                      )}
                    </div>

                    <div className="lg:col-span-2 space-y-3">
                      <h4 className="text-xs font-black text-purple-950 uppercase tracking-wider">Live Broadcast Stream Tracker ({announcements.length})</h4>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {announcements.map(ann => (
                          <div key={ann.id} className="bg-white border rounded-2xl p-3 flex justify-between items-start gap-3 hover:shadow-xs transition-all text-xs border-gray-100">
                            <div className="space-y-1 flex-1 overflow-hidden">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase shrink-0 ${ann.category === 'Urgent' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-purple-100 text-purple-800'}`}>{ann.category || 'General'}</span>
                                <span className="text-gray-400 font-medium text-[10px]">{formatToDisplayDate(ann.date)}</span>
                              </div>
                              <h5 className="font-bold text-purple-950 break-words">{ann.title}</h5>
                              <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed break-words">{ann.content}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                              <button onClick={(e) => startEditingAnn(ann, e)} className="p-1.5 text-blue-600 hover:bg-blue-50 bg-gray-50 rounded-lg cursor-pointer font-bold transition-all text-[11px]">✏️ Edit</button>
                              <button onClick={(e) => handleDeleteAnnouncement(ann.id, e)} className="p-1.5 text-red-600 hover:bg-red-50 bg-gray-50 rounded-lg cursor-pointer font-bold transition-all text-[11px]">🗑️ Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub View Feed Splitting blocks */}
            {(currentView === 'home' || currentView === 'announcements' || currentView === 'categories' || currentView === 'admin_dashboard') && (
              <div className="space-y-4">
                <h2 className="text-sm font-black uppercase text-purple-950 tracking-wider flex items-center gap-2 border-b pb-1.5 border-gray-100 break-words w-full">
                  <span>📢</span> Broadcasting Hub Notice Board {selectedCategory !== 'All' && `(${selectedCategory})`}
                </h2>
                {filteredAnnouncements.length === 0 ? (
                  <div className="p-6 text-center border border-dashed bg-gray-50/50 rounded-2xl text-xs text-gray-400">No active operational broadcasts listed under category: {selectedCategory}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredAnnouncements.map(ann => (
                      <div key={ann.id} onClick={() => setActiveDetails({ ...ann, type: 'announcement' })} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden w-full">
                        <div className="space-y-2 w-full overflow-hidden">
                          <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide shrink-0 ${ann.category === 'Urgent' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{ann.category || 'General'}</span>
                            <span className="truncate">{formatToDisplayDate(ann.date)}</span>
                          </div>
                          <h3 className="font-black text-purple-950 text-sm group-hover:text-purple-700 transition-colors leading-tight line-clamp-2 break-words">{ann.title}</h3>
                          <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed break-words">{ann.content}</p>
                        </div>
                        {ann.image && (
                          <div className="w-full h-24 rounded-2xl overflow-hidden bg-gray-100">
                            <img src={ann.image} alt="Broadcast context graphics attachment" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                          </div>
                        )}
                        
                        {/* INLINE ADMIN SHORTCUT ON THE MAIN BOARD CARDS */}
                        {userRole === 'admin' && (
                          <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => { setAdminSubView('broadcast_man'); startEditingAnn(ann, e); }} className="text-[11px] font-bold text-blue-600 hover:underline">✏️ Edit</button>
                            <button onClick={(e) => handleDeleteAnnouncement(ann.id, e)} className="text-[11px] font-bold text-red-600 hover:underline">🗑️ Delete</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LIVE EVENT FEED STREAM BLOCKS */}
            {(currentView === 'home' || currentView === 'events' || currentView === 'admin_dashboard') && (
              <div className="space-y-4 pt-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-1.5 border-gray-100 gap-2">
                  <h2 className="text-sm font-black uppercase text-purple-950 tracking-wider flex items-center gap-2 break-words w-full sm:w-auto">
                    <span>🗓️</span> Upcoming Live Campus Schedules {selectedCategory !== 'All' && `(${selectedCategory})`}
                  </h2>
                  {userRole === 'admin' && (
                    <div className="bg-white border rounded-2xl p-1 flex gap-1 self-start sm:self-auto">
                      <button onClick={() => setEditingEventId(null)} className="px-3 py-1 bg-purple-50 text-purple-950 font-bold rounded-xl text-[10px] uppercase whitespace-nowrap">Active Matrix</button>
                    </div>
                  )}
                </div>

                {editingEventId ? (
                  <div className="bg-purple-50/50 border rounded-3xl p-4 sm:p-5 max-w-xl animate-fadeIn">
                    <form onSubmit={saveUpdatedEvent} className="space-y-3 text-xs">
                      <div className="flex justify-between items-center border-b pb-2 mb-2">
                        <h4 className="font-black text-purple-950 uppercase tracking-wide truncate mr-2">✏️ Update Live Event Parameters</h4>
                        <button type="button" onClick={() => setEditingEventId(null)} className="text-gray-400 font-bold shrink-0">Cancel</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-gray-700 mb-0.5">TITLE</label>
                          <input type="text" className="w-full p-2 border rounded-xl bg-white" value={editEventData.title} onChange={ e => setEditEventData({ ...editEventData, title: e.target.value })} />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 mb-0.5">ORGANIZER</label>
                          <input type="text" className="w-full p-2 border rounded-xl bg-white" value={editEventData.organizer} onChange={ e => setEditEventData({ ...editEventData, organizer: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-gray-700 mb-0.5">LOCATION</label>
                          <input type="text" className="w-full p-2 border rounded-xl bg-white" value={editEventData.location} onChange={ e => setEditEventData({ ...editEventData, location: e.target.value })} />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 mb-0.5">DATE</label>
                          <input type="date" className="w-full p-2 border rounded-xl bg-white text-gray-700 cursor-pointer" value={editEventData.date} onChange={ e => setEditEventData({ ...editEventData, date: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block font-bold text-gray-700 mb-0.5">START TIME</label>
                          <input type="time" className="w-full p-2 border rounded-xl bg-white" value={editEventData.startTime} onChange={ e => setEditEventData({ ...editEventData, startTime: e.target.value })} />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 mb-0.5">END TIME</label>
                          <input type="time" className="w-full p-2 border rounded-xl bg-white" value={editEventData.endTime} onChange={ e => setEditEventData({ ...editEventData, endTime: e.target.value })} />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 mb-0.5">CATEGORY</label>
                          <select className="w-full p-2 border rounded-xl bg-white" value={editEventData.category} onChange={ e => setEditEventData({ ...editEventData, category: e.target.value })}>
                            <option value="General">General</option>
                            <option value="Academic">Academic</option>
                            <option value="Event">Event</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-0.5">SYNOPSIS DETAILS TEXT</label>
                        <textarea rows="3" className="w-full p-2 border rounded-xl bg-white" value={editEventData.content} onChange={ e => setEditEventData({ ...editEventData, content: e.target.value })} />
                      </div>
                      <button type="submit" className="w-full py-2.5 bg-purple-950 text-white font-black rounded-xl hover:bg-black transition-all">Save Matrix Modifications</button>
                    </form>
                  </div>
                ) : null}

                {filteredEvents.length === 0 ? (
                  <div className="p-8 text-center border border-dashed bg-gray-50/50 rounded-2xl text-xs text-gray-400">No scheduled campus timelines match the selection matrices.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(event => (
                      <div key={event.id} onClick={() => setActiveDetails({ ...event, type: 'event' })} className="bg-white border rounded-3xl overflow-hidden shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative border-gray-100 w-full">
                        {userRole === 'admin' && (
                          <div className="absolute left-3 top-3 z-10 flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => startEditingEvent(event, e)} className="bg-white/90 hover:bg-white text-blue-600 font-bold px-2 py-1 rounded-lg text-[11px] shadow-md transition-all cursor-pointer border border-gray-100">✏️ Edit</button>
                            <button onClick={(e) => handleDeleteEvent(event.id, e)} className="bg-white/90 hover:bg-red-50 text-red-600 font-bold px-2 py-1 rounded-lg text-[11px] shadow-md transition-all cursor-pointer border border-gray-100">🗑️ Delete</button>
                          </div>
                        )}
                        <div className="w-full">
                          <div className="w-full h-40 bg-purple-950/5 relative overflow-hidden">
                            {event.image ? (
                              <img src={event.image} alt="Event Cover attachment" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-purple-900/30 font-black text-5xl tracking-widest select-none bg-radial from-purple-900/10 to-transparent">UiTM</div>
                            )}
                            <div className="absolute right-3 bottom-3 bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full text-[9px] font-black uppercase text-purple-950 shadow-xs tracking-wide border border-white/20">
                              🕒 {event.startTime || '09:00'}
                            </div>
                          </div>
                          <div className="p-5 space-y-2 w-full overflow-hidden">
                            <div className="flex justify-between items-center text-[10px] font-bold text-amber-600 uppercase tracking-wide gap-2">
                              <span className="truncate">{event.category || 'Event'}</span>
                              <span className="text-gray-400 font-mono text-[9px] shrink-0">#{event.id}</span>
                            </div>
                            <h3 className="font-black text-purple-950 text-base leading-snug group-hover:text-purple-700 transition-colors line-clamp-2 break-words">{event.title}</h3>
                            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed break-words">{event.content || "No extended synopsis supplied for this operational segment node."}</p>
                          </div>
                        </div>
                        <div className="p-5 pt-0 w-full">
                          <div className="bg-gray-50 p-3 rounded-2xl text-[11px] text-gray-600 font-medium space-y-1 w-full overflow-hidden">
                            <div className="truncate">📅 Date: {formatToDisplayDate(event.date)}</div>
                            <div className="truncate">📍 Location: {event.location}</div>
                            <div className="truncate">👤 Host: {event.organizer}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* EXTENDED POPUP DETAILS OVERLAY VIEW SLOTS */}
      {activeDetails && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" onClick={() => { if(!showRegisterForm) setActiveDetails(null); }}>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5 animate-scaleUp" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-3 border-gray-100 gap-4">
              <div className="space-y-1 overflow-hidden">
                <span className="bg-purple-100 text-purple-800 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 inline-block">{activeDetails.category || activeDetails.type || 'Details'}</span>
                <h2 className="text-base font-black text-purple-950 leading-tight pt-1 break-words">{activeDetails.title}</h2>
              </div>
              <button onClick={() => { setActiveDetails(null); setShowRegisterForm(false); }} className="text-gray-400 hover:text-black font-black text-sm p-1 cursor-pointer shrink-0">✕</button>
            </div>

            {activeDetails.image && (
              <div className="w-full h-40 sm:h-48 rounded-2xl overflow-hidden bg-gray-50 border shadow-inner">
                <img src={activeDetails.image} alt="Modal presentation graphic attachment" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="text-xs text-gray-700 space-y-3 leading-relaxed whitespace-pre-wrap max-h-[200px] sm:max-h-[250px] overflow-y-auto pr-1 break-words">
              {activeDetails.content}
            </div>

            {(activeDetails.type === 'event' || activeDetails.type === 'announcement') && (
              <div className="bg-purple-50 p-4 rounded-2xl text-xs text-purple-950 space-y-2 border border-purple-100/50 w-full overflow-hidden">
                <h4 className="font-black uppercase tracking-wider text-[10px] text-purple-900">Logistics Parameters Mapping</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700 font-medium w-full">
                  <div className="truncate">📅 Scheduled Date: {formatToDisplayDate(activeDetails.date)}</div>
                  {activeDetails.type === 'event' && (
                    <>
                      <div className="truncate">📍 Exact Venue: {activeDetails.location}</div>
                      <div className="truncate">🕒 Time Interval: {activeDetails.startTime} - {activeDetails.endTime}</div>
                      <div className="truncate">👥 Lead Host Team: {activeDetails.organizer}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* SEAT RESERVATION WORKSPACE INLINE POPUP DRAWER */}
            {activeDetails.type === 'event' && userRole === 'user' && (
              <div className="pt-2 border-t border-gray-100 w-full">
                {!showRegisterForm ? (
                  <button onClick={() => setShowRegisterForm(true)} className="w-full py-3 bg-purple-950 hover:bg-black text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md text-center">
                    Reserve & Register Seat Securely
                  </button>
                ) : (
                  <form onSubmit={handleStudentRegistration} className="space-y-3 bg-gray-50 p-4 rounded-2xl border text-xs animate-fadeIn w-full">
                    <h4 className="font-black text-purple-950 uppercase tracking-wide">Enter Identity Data for Booking</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">FULL NAME</label>
                        <input
                          type="text" required placeholder="As per student ID card" className="w-full p-2 bg-white border rounded-xl"
                          value={studentForm.name} onChange={ e => setStudentForm({ ...studentForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">STUDENT ID NUMBER</label>
                        <input
                          type="text" required placeholder="e.g. 2024123456" className="w-full p-2 bg-white border rounded-xl"
                          value={studentForm.idNumber} onChange={ e => setStudentForm({ ...studentForm, idNumber: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">CAMPUS GOOGLE WORKSPACE EMAIL</label>
                      <input
                        type="email" required placeholder="username@student.uitm.edu.my" className="w-full p-2 bg-white border rounded-xl break-words"
                        value={studentForm.email} onChange={ e => setStudentForm({ ...studentForm, email: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 font-bold">
                      <button
                        type="button" onClick={() => setShowRegisterForm(false)}
                        className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all cursor-pointer text-center order-2 sm:order-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit" disabled={isRegistering}
                        className="w-full sm:w-auto px-5 py-2 bg-purple-950 text-white rounded-lg hover:bg-black transition-all cursor-pointer shadow-xs disabled:opacity-50 text-center order-1 sm:order-2"
                      >
                        {isRegistering ? "Processing Booking Sync..." : "Confirm Secure Registration"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FIXED NOTIFICATION LOG PANEL MODAL LEFT DRAWER */}
      {isNotifOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn" onClick={() => setIsNotifOpen(false)}>
          <div className="bg-white w-full max-w-sm h-full shadow-2xl p-5 flex flex-col justify-between animate-slideLeft" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden w-full">
              <div className="flex justify-between items-center border-b pb-3 gap-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-xs sm:text-sm font-black uppercase text-purple-950 tracking-wider truncate">System Pipeline Log</span>
                  {unreadCount > 0 && <span className="bg-red-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">{unreadCount} New</span>}
                </div>
                <button onClick={() => setIsNotifOpen(false)} className="text-gray-400 hover:text-black font-black text-sm p-1 cursor-pointer shrink-0">✕</button>
              </div>

              <div className="flex justify-between items-center text-[10px] font-bold">
                <button onClick={markAllAsRead} className="text-purple-950 hover:underline cursor-pointer">Mark all as read</button>
                <button onClick={clearAllNotifications} className="text-red-600 hover:underline cursor-pointer">Clear log stack</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs w-full">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed rounded-2xl bg-gray-50/50">Stack empty. No telemetry events generated.</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className={`p-3 rounded-xl border transition-all relative w-full overflow-hidden ${notif.unread ? 'bg-purple-50/60 border-purple-100 shadow-xs' : 'bg-white border-gray-100'}`}>
                      {notif.unread && <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-purple-600"></span>}
                      <h5 className="font-bold text-purple-950 max-w-[85%] truncate">{notif.title}</h5>
                      <p className="text-[11px] text-gray-600 mt-0.5 leading-normal break-words">{notif.description}</p>
                      <span className="text-[9px] font-mono text-gray-400 block mt-1.5 text-right">{notif.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4 w-full">
              <button onClick={() => setIsNotifOpen(false)} className="w-full py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-all cursor-pointer text-center">
                Close Stream Log Overlay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CORE ALERTS OVERLAY DESIGN WINDOW CONTAINER */}
      <PremiumDialogModal
        isOpen={dialogState.isOpen}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={() => {
          if (dialogState.onConfirm) dialogState.onConfirm();
          closeModal();
        }}
        onCancel={closeModal}
      />

      <footer className="bg-purple-950 text-white text-xs mt-auto border-t-4 border-amber-400 w-full">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-black uppercase text-amber-400">UiTM Events Manager Cluster</h4>
            <p className="text-purple-200 text-[11px] leading-relaxed max-w-xs break-words">An enterprise real-time event pipeline solution bridging direct Supabase clusters with student Google Workspaces natively.</p>
          </div>
          <div className="space-y-1">
            <h4 className="font-black uppercase text-amber-400">Directory Context</h4>
            <ul className="space-y-1 text-purple-200">
              <li><button onClick={() => handleFooterLinkClick('motto')} className="hover:text-white text-left cursor-pointer">Motto & Vision</button></li>
              <li><button onClick={() => handleFooterLinkClick('history')} className="hover:text-white text-left cursor-pointer">Historical Development</button></li>
              <li><button onClick={() => handleFooterLinkClick('portal')} className="hover:text-white text-left cursor-pointer">UiTM Official Portal</button></li>
            </ul>
          </div>
          <div className="space-y-1">
            <h4 className="font-black uppercase text-amber-400">Support Desk</h4>
            <ul className="space-y-1 text-purple-200">
              <li><button onClick={() => handleFooterLinkClick('faq')} className="hover:text-white text-left cursor-pointer">Help / FAQ</button></li>
              <li><button onClick={() => handleFooterLinkClick('privacy')} className="hover:text-white text-left cursor-pointer">Privacy Policy</button></li>
              <li><button onClick={() => handleFooterLinkClick('support')} className="hover:text-white text-left cursor-pointer">Campus Support Email</button></li>
            </ul>
          </div>
        </div>
        <div className="bg-purple-900/40 text-center py-3 text-[10px] text-purple-300 border-t border-purple-900/30 px-4 break-words">
          &copy; {new Date().getFullYear()} Universiti Teknologi MARA. Encrypted Remote Database Stream Node Handshake Active.
        </div>
      </footer>
    </div>
  );
}

export default App;