import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { filesApi } from '../api'
import toast from 'react-hot-toast'

export default function Analytics() {
  const { fileId } = useParams()
  const [loading, setLoading] = useState(false)

  // If fileId is passed, pre-load that file into the iframe
  const iframeSrc = '/analytics-tool/datahub-pro.html'

  return (
    <div style={{ margin: '-24px', height: 'calc(100vh - 56px)' }}>
      {loading && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 600, color: '#0c1446' }}>Loading Analytics...</div>
          </div>
        </div>
      )}
      <iframe
        src={iframeSrc}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="DataHub Pro Analytics"
      />
    </div>
  )
}
