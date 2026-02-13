'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface Room {
  id: string;
  name: string;
  photos: string[];
  uploading: boolean;
}

export default function PhotoUploadComponent() {
  const { user } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([
    { id: '1', name: 'Living Room', photos: [], uploading: false },
  ]);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const addRoom = () => {
    const newRoom: Room = {
      id: Date.now().toString(),
      name: `Room ${rooms.length + 1}`,
      photos: [],
      uploading: false,
    };
    setRooms([...rooms, newRoom]);
  };

  const removeRoom = (roomId: string) => {
    setRooms(rooms.filter((r) => r.id !== roomId));
  };

  const updateRoomName = (roomId: string, newName: string) => {
    setRooms(
      rooms.map((r) => (r.id === roomId ? { ...r, name: newName } : r))
    );
  };

  const uploadPhotos = async (roomId: string, files: FileList) => {
    if (!files || files.length === 0) return;

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

        const { data, error } = await supabase.storage
          .from('movco-photos')
          .upload(filePath, file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('movco-photos')
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      setRooms(
        rooms.map((r) =>
          r.id === roomId
            ? { ...r, photos: [...r.photos, ...uploadedUrls], uploading: false }
            : r
        )
      );
    } catch (err) {
      console.error('Error during upload:', err);
      setRooms(
        rooms.map((r) => (r.id === roomId ? { ...r, uploading: false } : r))
      );
    }
  };

  const removePhoto = (roomId: string, photoUrl: string) => {
    setRooms(
      rooms.map((r) =>
        r.id === roomId
          ? { ...r, photos: r.photos.filter((p) => p !== photoUrl) }
          : r
      )
    );
  };

  const analyzeMove = async () => {
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
      const response = await fetch('https://movco-api.onrender.com/analyze', {
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

      // SAVE QUOTE TO SUPABASE WITH USER ID
      const { error: saveError } = await supabase
        .from('instant_quotes')
        .insert({
          starting_address: startAddress,
          ending_address: endAddress,
          photo_urls: allPhotoUrls,
          status: 'new',
          user_id: user?.id,
        });

      if (saveError) {
        console.error('Error saving quote:', saveError);
      } else {
        console.log('Quote saved successfully with user_id:', user?.id);
      }

    } catch (err: any) {
      console.error('Analysis error:', err);
      alert('Failed to analyze. Check console and backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  const totalPhotos = rooms.reduce((sum, r) => sum + r.photos.length, 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Get Your Moving Quote
              </h1>
              <p className="text-slate-600">
                Upload photos of your rooms and get an instant AI-powered estimate
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-white/80 backdrop-blur-sm text-slate-700 font-semibold rounded-xl shadow-lg hover:shadow-xl border border-white/20 hover:bg-white transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Rooms</p>
                  <p className="text-3xl font-bold text-slate-800">{rooms.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Photos Uploaded</p>
                  <p className="text-3xl font-bold text-green-600">{totalPhotos}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Status</p>
                  <p className="text-lg font-bold text-purple-600">
                    {result ? 'Complete' : analyzing ? 'Analyzing...' : 'Ready'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/20 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Moving Addresses</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Starting Address</label>
              <input
                type="text"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                placeholder="123 Main St, London"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="flex justify-center">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ending Address</label>
              <input
                type="text"
                value={endAddress}
                onChange={(e) => setEndAddress(e.target.value)}
                placeholder="456 Oak Ave, Manchester"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Room Sections */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Room Photos</h2>
                <p className="text-sm text-slate-500">Add 3-4 photos per room for the most accurate estimate</p>
              </div>
            </div>
            <button
              onClick={addRoom}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Room</span>
            </button>
          </div>

          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room.id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 transition-all duration-200 hover:shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={room.name}
                    onChange={(e) => updateRoomName(room.id, e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {rooms.length > 1 && (
                    <button onClick={() => removeRoom(room.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <label className="block cursor-pointer mb-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    {room.uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-blue-600 font-medium">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-700 font-medium">Click to upload photos</p>
                        <p className="text-sm text-slate-400 mt-1">or drag and drop</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files && uploadPhotos(room.id, e.target.files)}
                    disabled={room.uploading}
                    className="hidden"
                  />
                </label>

                {room.photos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {room.photos.map((photoUrl, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                        <img src={photoUrl} alt={`${room.name} photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                        <button
                          onClick={() => removePhoto(room.id, photoUrl)}
                          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-200 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={analyzeMove}
          disabled={analyzing}
          className={`w-full py-4 px-6 rounded-2xl text-white font-bold text-lg shadow-xl transition-all duration-200 ${
            analyzing
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-2xl transform hover:scale-[1.02]'
          }`}
        >
          {analyzing ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing Your Move...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Get Moving Quote
            </span>
          )}
        </button>

        {/* Results */}
        {result && (
          <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Your Quote</h2>
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white text-center">
              <p className="text-sm opacity-80 mb-1">Estimated Cost</p>
              <p className="text-5xl font-bold mb-2">£{result.estimate.toFixed(2)}</p>
              <p className="text-sm opacity-80">{result.description}</p>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Items Detected</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <span className="text-slate-700 font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-800 font-semibold">×{item.quantity}</span>
                      {item.estimated_volume_ft3 && (
                        <span className="text-xs text-slate-500 ml-2">
                          {item.estimated_volume_ft3.toFixed(1)} ft³
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <span className="text-slate-600 font-medium">Total Volume</span>
              <span className="text-slate-800 font-bold">
                {result.totalVolumeM3} m³ ({result.totalAreaM2} m² equivalent)
              </span>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200"
              >
                <span>View All Quotes</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
