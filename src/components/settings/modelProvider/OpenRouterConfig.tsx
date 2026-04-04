import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import settingsStore from '@/features/stores/settings'
import { ApiKeyInput } from './ApiKeyInput'
import { MultiModalToggle } from './MultiModalToggle'

interface OpenRouterConfigProps {
  openrouterKey: string
  selectAIModel: string
  enableMultiModal: boolean
}

export const OpenRouterConfig = ({
  openrouterKey,
  selectAIModel,
  enableMultiModal,
}: OpenRouterConfigProps) => {
  const { t } = useTranslation()

  const handleMultiModalToggle = useCallback(() => {
    settingsStore.setState({ enableMultiModal: !enableMultiModal })
  }, [enableMultiModal])

  return (
    <>
      <ApiKeyInput
        label={t('OpenRouterAPIKeyLabel')}
        value={openrouterKey}
        onChange={(value) => settingsStore.setState({ openrouterKey: value })}
        linkUrl="https://openrouter.ai/keys"
        linkLabel={t('OpenRouterDashboardLink', 'OpenRouter Dashboard')}
      />

      <div className="my-6">
        <div className="my-4 text-xl font-bold">{t('SelectModel')}</div>
        <input
          className="text-ellipsis px-4 py-2 w-col-span-2 bg-white hover:bg-white-hover rounded-lg"
          type="text"
          value={selectAIModel}
          onChange={(e) =>
            settingsStore.setState({ selectAIModel: e.target.value })
          }
        />
        <div className="my-2 text-sm text-gray-500">
          {t('OpenRouterModelNameInstruction') ||
            'Please enter the model identifier from OpenRouter (e.g., "openai/gpt-4o", "mistralai/mistral-large-latest"). Note: Only models that support API v2 specification are compatible.'}
        </div>
        <div className="my-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
          ⚠️ Some free models (e.g., models with &quot;:free&quot; suffix) may
          only support API v1 and will not work. Please use v2-compatible models
          from{' '}
          <a
            href="https://openrouter.ai/models"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            OpenRouter Models
          </a>
        </div>
      </div>

      <MultiModalToggle
        enabled={enableMultiModal}
        onToggle={handleMultiModalToggle}
      />
    </>
  )
}
