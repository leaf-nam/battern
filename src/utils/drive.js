const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

async function errMsg(res) {
  try {
    const body = await res.json()
    return `${res.status} ${res.statusText}: ${body.error?.message || JSON.stringify(body)}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

export async function listDriveFiles(token) {
  const res = await fetch(`${DRIVE_API}?q=mimeType='application/json' and name contains '.pattern'&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await errMsg(res))
  const data = await res.json()
  return data.files || []
}

export async function readDriveFile(token, fileId) {
  const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await errMsg(res))
  return res.json()
}

export async function createDriveFile(token, name, data) {
  const metaRes = await fetch(DRIVE_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, mimeType: 'application/json' }),
  })
  if (!metaRes.ok) throw new Error(await errMsg(metaRes))
  const { id } = await metaRes.json()
  const contentRes = await fetch(`${DRIVE_UPLOAD}/${id}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!contentRes.ok) throw new Error(await errMsg(contentRes))
  return contentRes.json()
}
