import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Miel ERP',
    short_name: 'Miel',
    description: 'Gestión empresarial',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#fdb409',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
