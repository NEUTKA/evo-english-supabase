# Evo-English Supabase Functions

Серверные функции для платформы Evo-English, построенные на Supabase Edge Functions (Deno).

## Функции

### 🔄 Перевод (translate)
- Перевод текста с использованием Google Translate API
- Поддержка гостевых пользователей с лимитом 20 переводов в день
- Авторизация через Supabase Auth

### 🤖 AI Ассистент (assistant_rest)
- Чат-бот для изучения английского языка (уровни A1-B2)
- Интеграция с OpenAI API
- Поддержка русского и английского языков
- Ограничение входного текста: 240 символов

### 📧 Рассылка (evo-mailer)
- Автоматическая отправка email-уведомлений
- Интеграция с Resend API
- Напоминания о продолжении обучения

### 🌐 Языки (languages)
- Получение списка поддерживаемых языков от Google Translate
- Кеширование на 24 часа

### 🗑️ Удаление аккаунта (delete-account)
- Безопасное удаление пользовательских аккаунтов

### 📊 Прогресс уроков (user_lesson_progress)
- Отслеживание прогресса обучения пользователей

### 📡 Телеметрия (alert_telemetry)
- Сбор аналитики и метрик использования

## Установка и настройка

### Предварительные требования
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Аккаунт Supabase

### Переменные окружения
Создайте файл `.env.local` в корне проекта:

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_BASE=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_CLASSIFIER_MODEL=gpt-4o-mini
OPENAI_WHISPER_MODEL=whisper-1
OPENAI_MAX_OUTPUT_TOKENS=160
OPENAI_TEMPERATURE=0.2
OPENAI_ENABLE_MODERATION=true
OPENAI_MODERATION_MODEL=omni-moderation-latest

# Google Translate
GOOGLE_TRANSLATE_KEY=your_google_translate_key

# Email (Resend)
RESEND_API_KEY=your_resend_key
FROM_EMAIL=Evo-English <no-reply@evo-english.com>
ADMIN_NOTIFY_EMAIL=your_admin_email
UNSUBSCRIBE_SECRET=your_unsubscribe_secret
EVO_CRON_SECRET=your_cron_secret
```

### Запуск локально

1. Установите зависимости:
```bash
supabase start
```

2. Запустите функции:
```bash
supabase functions serve
```

### Деплой

```bash
supabase functions deploy
```

## Безопасность

- Все API ключи хранятся в переменных окружения
- CORS ограничен доверенными доменами
- Валидация входных данных
- Лимиты для гостевых пользователей

## Лицензия

Этот проект предназначен только для образовательных целей.