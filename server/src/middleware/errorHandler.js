export function errorHandler(err, req, res, next) {
  console.error(err)
  if (err?.message?.startsWith('CORS blocked')) {
    return res.status(403).json({ error: 'Origin not allowed.' })
  }
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      error: 'That image is too large. Please use a file under 2 MB.',
    })
  }
  res.status(err.status || 500).json({
    error: err.expose ? err.message : 'Something went wrong.',
  })
}
