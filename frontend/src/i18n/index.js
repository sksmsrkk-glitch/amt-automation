// ============================================================
// i18n(다국어) 초기화
// ------------------------------------------------------------
// 외국인 고객 대상 서비스이므로 영어(en)와 중국어(cn)를 지원한다.
// - en.json / cn.json 에 번역 리소스 정의
// - 사용자가 선택한 언어는 localStorage('language') 에 저장
// - 누락된 키는 영어(fallbackLng)로 대체
// ============================================================

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import cn from './cn.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cn: { translation: cn }
  },
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false // React 가 이미 XSS 이스케이핑을 하므로 비활성화
  }
})

export default i18n
