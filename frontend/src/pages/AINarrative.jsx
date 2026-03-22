import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function AINarrative() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [narrativeType, setNarrativeType] = useState('executive')
  const [loading, setLoading] = useState(false)
  const [narrative, setNarrative] = useState(null)
