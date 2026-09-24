export const SEGMENTS = [
    { key: 'semua', label: 'Semua', role: '', statuses: null },
    { key: 'baru', label: 'Baru', role: 'HP', statuses: ['NEW'] },
    { key: 'diproses', label: 'Diproses', role: 'HP', statuses: ['OPEN'] },
    { key: 'ditugaskan', label: 'Ditugaskan', role: 'PM', statuses: ['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE'] },
    { key: 'dikerjakan', label: 'Dikerjakan', role: 'TEK', statuses: ['WORKING'] },
    { key: 'dijeda', label: 'Dijeda', role: 'PM', statuses: ['PENDING'] },
    { key: 'selesai', label: 'Selesai', role: 'HP', statuses: ['RESOLVED'] },
    { key: 'tutup', label: 'Tutup', role: '', statuses: ['CLOSED'] },
]
