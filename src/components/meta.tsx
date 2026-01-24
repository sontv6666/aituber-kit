import { buildUrl } from '@/utils/buildUrl'
import Head from 'next/head'
export const Meta = () => {
  const title = 'Cô Mây - Cô Giáo Toán Tiểu Học'
  const description =
    'Cô Mây là cô giáo AI dạy toán cho học sinh tiểu học. Con có thể học toán cùng cô Mây một cách vui vẻ và dễ hiểu.'
  const imageUrl = '/ogp.png'
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Head>
  )
}
