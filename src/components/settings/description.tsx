import { useTranslation } from 'react-i18next'
import Image from 'next/image'

const Description = () => {
  const { t } = useTranslation()

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center mb-6">
          <Image
            src="/images/setting-icons/description.svg"
            alt="Description Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">{t('AboutThisApplication')}</h2>
        </div>
        <div className="mb-6">
          <div className="my-2 whitespace-pre-line">
            {t('AboutThisApplicationDescription2')}
          </div>
        </div>
      </div>
    </>
  )
}
export default Description
