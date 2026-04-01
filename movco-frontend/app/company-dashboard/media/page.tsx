'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

const TAGS = ['All', 'Logo', 'Team', 'Job Photos', 'Social Media', 'Website', 'Documents', 'Other']

interface MediaFile {
  id: string
  company_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  tags: string[]
  created_at: string
}

export default function MediaLibraryPage() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedTag, setSelectedTag] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [tagModalFile, setTagModalFile] = useState<MediaFile | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFiles()
  }, [])

  async function fetchFiles() {
    setLoading(true)
    try {
      const res = await fetch(`/api/media/list?company_id=${COMPANY_ID}`)
      const data = await res.json()
      setFiles(data.files || [])
    } catch {
      setFiles([])
    }
    setLoading(false)
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadProgress(0)
    try {
      setUploadProgress(20)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('company_id', COMPANY_ID)
      formData.append('tags', JSON.stringify(selectedTags))

      setUploadProgress(50)

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setUploadProgress(100)
      await fetchFiles()
      setSelectedTags([])
    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload failed. Please try again.')
    }
    setUploading(false)
    setUploadProgress(0)
  }

  async function deleteFile(file: MediaFile) {
    await fetch('/api/media/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: file.id, file_url: file.file_url }),
    })
    setDeleteConfirm(null)
    fetchFiles()
  }

  async function updateTags(file: MediaFile, tags: string[]) {
    await supabase.from('media_library').update({ tags }).eq('id', file.id)
    setTagModalFile(null)
    fetchFiles()
  }

  function copyUrl(file: MediaFile) {
    navigator.clipboard.writeText(file.file_url)
    setCopiedId(file.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function formatSize(bytes: number) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function isImage(file: MediaFile) {
    return file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.file_name)
  }

  function isVideo(file: MediaFile) {
    return file.file_type?.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(file.file_name)
  }

  const filteredFiles = files.filter(f => {
    const matchesTag = selectedTag === 'All' || f.tags?.includes(selectedTag)
    const matchesSearch = !searchQuery || f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTag && matchesSearch
  })

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    droppedFiles.forEach(uploadFile)
  }

  return (
    <div style={{ padding: '28px', minHeight: '100vh', background: '#f8f9fa', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0a0f1c', margin: 0 }}>Media Library</h1>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Store and manage your photos, logos and files — use them across social posts and your website
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: '#0F6E56', color: '#fff', border: 'none', borderRadius: '10px',
            padding: '12px 24px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>+</span> Upload Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={e => Array.from(e.target.files || []).forEach(uploadFile)}
        />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Files', value: files.length },
          { label: 'Images', value: files.filter(isImage).length },
          { label: 'Videos', value: files.filter(isVideo).length },
          { label: 'Other', value: files.filter(f => !isImage(f) && !isVideo(f)).length },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #eee' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0a0f1c' }}>{stat.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#0F6E56' : '#ddd'}`,
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          marginBottom: '24px',
          background: dragOver ? '#f0faf7' : '#fff',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⬆️</div>
            <p style={{ color: '#0F6E56', fontWeight: 600, margin: '0 0 12px' }}>Uploading...</p>
            <div style={{ background: '#e5e5e5', borderRadius: '100px', height: '6px', maxWidth: '200px', margin: '0 auto' }}>
              <div style={{ background: '#0F6E56', height: '6px', borderRadius: '100px', width: `${uploadProgress}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📁</div>
            <p style={{ color: '#555', margin: '0 0 4px', fontWeight: 600 }}>Drop files here or click to upload</p>
            <p style={{ color: '#aaa', margin: 0, fontSize: '0.82rem' }}>Images, videos, PDFs and documents supported</p>
          </>
        )}
      </div>

      {/* Tag preset selector for uploads */}
      <div style={{ marginBottom: '24px', background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #eee' }}>
        <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.85rem', color: '#555' }}>Tag new uploads as:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {TAGS.filter(t => t !== 'All').map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
              style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                background: selectedTags.includes(tag) ? '#0F6E56' : '#f0f0f0',
                color: selectedTags.includes(tag) ? '#fff' : '#555',
                border: 'none', transition: 'all 0.15s'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: '10px 16px', borderRadius: '10px',
            border: '1px solid #ddd', fontSize: '0.9rem', outline: 'none'
          }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                background: selectedTag === tag ? '#0a0f1c' : '#fff',
                color: selectedTag === tag ? '#fff' : '#555',
                border: '1px solid #ddd', transition: 'all 0.15s'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Files Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#aaa' }}>Loading your media library...</div>
      ) : filteredFiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#aaa', background: '#fff', borderRadius: '12px', border: '1px solid #eee' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🖼️</div>
          <p style={{ fontWeight: 600, color: '#555', margin: '0 0 4px' }}>No files yet</p>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Upload your first file by dragging it above or clicking Upload Files</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {filteredFiles.map(file => (
            <div
              key={file.id}
              style={{
                background: '#fff', borderRadius: '12px', border: '1px solid #eee',
                overflow: 'hidden', transition: 'box-shadow 0.2s',
              }}
            >
              {/* Preview */}
              <div style={{ position: 'relative', height: '140px', background: '#f5f5f5', overflow: 'hidden' }}>
                {isImage(file) ? (
                  <img
                    src={file.file_url}
                    alt={file.file_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : isVideo(file) ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '2.5rem' }}>🎬</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '2.5rem' }}>
                    {file.file_name.endsWith('.pdf') ? '📄' : '📎'}
                  </div>
                )}
                <button
                  onClick={() => setDeleteConfirm(file.id)}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none',
                    borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Info */}
              <div style={{ padding: '12px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.8rem', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.file_name}
                </p>
                <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#aaa' }}>{formatSize(file.file_size)}</p>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {(file.tags || []).map(tag => (
                    <span key={tag} style={{ background: '#e8f5f0', color: '#0F6E56', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                      {tag}
                    </span>
                  ))}
                  <button
                    onClick={() => setTagModalFile(file)}
                    style={{ background: '#f0f0f0', color: '#888', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', border: 'none', cursor: 'pointer' }}
                  >
                    + tag
                  </button>
                </div>

                {/* Copy URL button */}
                <button
                  onClick={() => copyUrl(file)}
                  style={{
                    width: '100%', padding: '7px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                    background: copiedId === file.id ? '#0F6E56' : '#f0f0f0',
                    color: copiedId === file.id ? '#fff' : '#555',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {copiedId === file.id ? '✓ Copied!' : '📋 Copy URL'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag Modal */}
      {tagModalFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Edit Tags</h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#888' }}>{tagModalFile.file_name}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {TAGS.filter(t => t !== 'All').map(tag => {
                const active = tagModalFile.tags?.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = active
                        ? tagModalFile.tags.filter(t => t !== tag)
                        : [...(tagModalFile.tags || []), tag]
                      setTagModalFile({ ...tagModalFile, tags: newTags })
                    }}
                    style={{
                      padding: '7px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                      background: active ? '#0F6E56' : '#f0f0f0',
                      color: active ? '#fff' : '#555',
                      border: 'none', transition: 'all 0.15s'
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setTagModalFile(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={() => updateTags(tagModalFile, tagModalFile.tags)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#0F6E56', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Save Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '360px', maxWidth: '90vw', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px' }}>Delete this file?</h3>
            <p style={{ color: '#888', margin: '0 0 24px', fontSize: '0.9rem' }}>This cannot be undone. The file will be permanently removed.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteFile(files.find(f => f.id === deleteConfirm)!)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#e53e3e', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}