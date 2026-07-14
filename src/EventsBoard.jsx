import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Ensure your supabase client is imported correctly

export default function EventsBoard() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Registration Form State
  const [formData, setFormData] = useState({
    studentName: '',
    studentIdNumber: '',
    studentEmail: ''
  });

  // Fetch active events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });
    
    if (!error && data) {
      setEvents(data);
    } else {
      console.error("Error fetching events:", error);
    }
  };

  // Handle registration submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from('event_registrations')
      .insert([
        {
          event_id: selectedEvent.id,
          student_name: formData.studentName,
          student_id_number: formData.studentIdNumber,
          student_email: formData.studentEmail
        }
      ]);

    setLoading(false);

    if (error) {
      if (error.code === '23505') {
        alert("You have already registered for this event!");
      } else {
        alert("Registration failed: " + error.message);
      }
    } else {
      alert(`Successfully registered for ${selectedEvent.title}!`);
      // Reset form and close modal
      setFormData({ studentName: '', studentIdNumber: '', studentEmail: '' });
      setShowRegisterModal(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#4A0E4E', borderBottom: '2px solid #4A0E4E', paddingBottom: '10px' }}>
        ACTIVE CAMPUS EVENTS BOARD
      </h2>

      {/* Events Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {events.map((event) => (
          <div 
            key={event.id} 
            style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
            onClick={() => setSelectedEvent(event)}
          >
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>{event.title}</h3>
            <p style={{ margin: '5px 0', color: '#666' }}><strong>Organizer:</strong> {event.organizer}</p>
            <p style={{ margin: '5px 0', color: '#666' }}><strong>Date:</strong> {event.date}</p>
            <button 
              style={{ background: '#4A0E4E', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
              onClick={(e) => {
                e.stopPropagation(); // Prevents triggering container click twice
                setSelectedEvent(event);
              }}
            >
              View Event Details
            </button>
          </div>
        ))}
      </div>

      {/* Expanded Detailed View Panel */}
      {selectedEvent && (
        <div style={{ marginTop: '40px', border: '1px solid #4A0E4E', borderRadius: '12px', padding: '25px', backgroundColor: '#fff', position: 'relative' }}>
          <button 
            style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => setSelectedEvent(null)}
          >
            ✕ Close View
          </button>
          
          <span style={{ color: '#E65C00', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>{selectedEvent.organizer}</span>
          <h1 style={{ margin: '5px 0 20px 0', color: '#111' }}>{selectedEvent.title}</h1>

          {selectedEvent.image && (
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img src={selectedEvent.image} alt="Event Banner" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ backgroundColor: '#F9F9F9', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', marginBottom: '20px' }}>
            <p><strong>Date:</strong> {selectedEvent.date}</p>
            <p><strong>Duration:</strong> {selectedEvent.startTime} - {selectedEvent.endTime}</p>
            <p><strong>Venue:</strong> {selectedEvent.location}</p>
          </div>

          <p style={{ lineHeight: '1.6', color: '#444', marginBottom: '30px' }}>{selectedEvent.content}</p>

          {/* REGISTER EVENT BUTTON */}
          <div style={{ textAlign: 'center' }}>
            <button 
              onClick={() => setShowRegisterModal(true)}
              style={{ background: '#00cc66', color: 'white', fontSize: '18px', fontWeight: 'bold', border: 'none', padding: '12px 35px', borderRadius: '25px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,204,102,0.3)' }}
            >
              Register for Event
            </button>
          </div>
        </div>
      )}

      {/* STUDENT REGISTRATION POPUP MODAL */}
      {showRegisterModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '450px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#4A0E4E' }}>Event Registration</h3>
            <p style={{ margin: '0 0 20px 0', color: '#555', fontSize: '14px' }}>Securing your slot for: <strong>{selectedEvent?.title}</strong></p>

            <form onSubmit={handleRegisterSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Full Name:</label>
                <input 
                  type="text" 
                  required
                  value={formData.studentName}
                  onChange={(e) => setFormData({...formData, studentName: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Student ID Number:</label>
                <input 
                  type="text" 
                  required
                  value={formData.studentIdNumber}
                  onChange={(e) => setFormData({...formData, studentIdNumber: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Campus Email:</label>
                <input 
                  type="email" 
                  required
                  value={formData.studentEmail}
                  onChange={(e) => setFormData({...formData, studentEmail: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setShowRegisterModal(false)}
                  style={{ background: '#eee', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ background: '#4A0E4E', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {loading ? 'Submitting...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}