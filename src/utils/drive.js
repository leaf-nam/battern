const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'

export async function listDriveFiles(token) {
  const res = await fetch(`${DRIVE_FILES}?q=mimeType='application/json' and name contains '.pattern'&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to list files')
  const data = await res.json()
  return data.files || []
}

export async function readDriveFile(token, fileId) {
  const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to read file')
  return res.json()
}

export async function createDriveFile(token, name, data) {
  const boundary = 'drive_boundary'
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name, mimeType: 'application/json' }),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(data),
    `--${boundary}--`,
  ].join('\r\n')
  const res = await fetch(`${DRIVE_FILES}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!res.ok) throw new Error('Failed to create file')
  return res.json()
}

export async function updateDriveFile(token, fileId, data) {
  const res = await fetch(`${DRIVE_FILES}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update file')
  return res.json()
}
