'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Room {
  id: string;
  name: string;
  photos: string[]; // Supabase URLs
  uploading: boolean;
}

export default function PhotoUploadComponent() {
  const [rooms, setRooms] = useState<Room[]>([
    { id: '1', name: 'Living Room', photos: [], uploading: false },
  ]);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Add a new room
  const addRoom = () => {
    const newRoom: Room = {
      id: Date.now().toString(),
      name: `Room ${rooms.length + 1}`,
      photos: [],
      uploading: false,
    };
    setRooms([...rooms, newRoom]);
  };

  // Remove a room
  const removeRoom = (roomId: string) => {
    setRooms(rooms.filter((r) => r.id !== roomId));
  };

  // Update room name
  const updateRoomName = (roomId: string, newName: string) => {
    setRooms(
      rooms.map((r) => (r.id === roomId ? { ...r, name: newName } : r))
    );
  };

  // Upload photos for a specific room
  const uploadPhotos = async (roomId: string, files: FileList) => {
    if (!files || files.length === 0) return;

    // Set uploading state
    setRooms(
      rooms.map((r) => (r.id === roomId ? { ...r, uploading: true } : r))
    );

    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${roomId}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `room-photos/${fileName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('movco-photos') // Make sure this bucket exists in your Supabase project
          .upload(filePath, file);

        if (error) {
          console.error('Upload error:', error);
          alert(`Failed to upload ${file.name}: ${error.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('movco-photos')
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      // Update room with new photo URLs
      setRooms(
        rooms.map((r) =>
          r.id === roomId
            ? { ...r, photos: [...r.photos, ...uploadedUrls], uploading: false }
            : r
        )
      );
    } catch (err) {
      console.error('Error during upload:', err);
      alert('Upload failed. Check console for details.');
      setRooms(
        rooms.map((r) => (r.id === roomId ? { ...r, uploading: false } : r))
      );
    }
  };

  // Remove a specific photo
  const removePhoto = (roomId: string, photoUrl: string) => {
    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? { ...r, photos: r.photos.filter((p) => p !== photoUrl) }
          : r
      )
    );
  };

  // Submit to backend for analysis
  const analyzeMove = async () => {
    // Collect all photo URLs from all rooms
    const allPhotoUrls = rooms.flatMap((r) => r.photos);

    if (allPhotoUrls.length === 0) {
      alert('Please upload at least one photo');
      return;
    }

    if (!startAddress || !endAddress) {
      alert('Please enter starting and ending addresses');
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_address: startAddress,
          ending_address: endAddress,
          photo_urls: allPhotoUrls,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Analysis error:', err);
      alert('Failed to analyze. Check console and backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>MOVCO - Get Your Moving Quote</h1>

      {/* Address inputs */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Starting Address
          </label>
          <input
            type="text"
            value={startAddress}
            onChange={(e) => setStartAddress(e.target.value)}
            placeholder="123 Main St, London"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 16,
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Ending Address
          </label>
          <input
            type="text"
            value={endAddress}
            onChange={(e) => setEndAddress(e.target.value)}
            placeholder="456 Oak Ave, Manchester"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 16,
            }}
          />
        </div>
      </div>

      {/* Room sections */}
      <h2 style={{ marginBottom: 16 }}>Upload Room Photos</h2>
      <p style={{ marginBottom: 24, color: '#666' }}>
        Add 3-4 photos per room for the most accurate estimate
      </p>

      {rooms.map((room) => (
        <div
          key={room.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <input
              type="text"
              value={room.name}
              onChange={(e) => updateRoomName(room.id, e.target.value)}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 16,
                fontWeight: 500,
                color: '#000',
              }}
            />
            {rooms.length > 1 && (
              <button
                onClick={() => removeRoom(room.id)}
                style={{
                  padding: '8px 12px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            )}
          </div>

          {/* Photo upload input */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && uploadPhotos(room.id, e.target.files)}
              disabled={room.uploading}
              style={{ display: 'block', marginBottom: 8, color: '#000' }}
            />
            {room.uploading && (
              <p style={{ color: '#2563eb', fontSize: 14 }}>Uploading...</p>
            )}
          </div>

          {/* Uploaded photos preview */}
          {room.photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {room.photos.map((photoUrl, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: 120,
                    height: 120,
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={photoUrl}
                    alt={`${room.name} photo ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    onClick={() => removePhoto(room.id, photoUrl)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add room button */}
      <button
        onClick={addRoom}
        style={{
          padding: '10px 16px',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          marginBottom: 24,
          fontSize: 16,
        }}
      >
        + Add Another Room
      </button>

      {/* Analyze button */}
      <div style={{ marginTop: 32 }}>
        <button
          onClick={analyzeMove}
          disabled={analyzing}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: analyzing ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: analyzing ? 'not-allowed' : 'pointer',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {analyzing ? 'Analyzing...' : 'Get Moving Quote'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div
          style={{
            marginTop: 32,
            padding: 20,
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 8,
            color: '#000',
          }}
        >
          <h2 style={{ marginBottom: 16, color: '#000' }}>Your Quote</h2>
          <p style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, color: '#000' }}>
            £{result.estimate.toFixed(2)}
          </p>
          <p style={{ marginBottom: 16, color: '#333' }}>{result.description}</p>

          <h3 style={{ marginBottom: 12, color: '#000' }}>Items Detected:</h3>
          <ul style={{ marginBottom: 16, color: '#000' }}>
            {result.items.map((item: any, idx: number) => (
              <li key={idx}>
                {item.name} × {item.quantity}
                {item.estimated_volume_ft3 && ` (${item.estimated_volume_ft3.toFixed(1)} ft³)`}
              </li>
            ))}
          </ul>

          <p style={{ fontSize: 14, color: '#333' }}>
            Total Volume: {result.totalVolumeM3} m³ ({result.totalAreaM2} m² equivalent)
          </p>
        </div>
      )}
    </div>
  );
}
