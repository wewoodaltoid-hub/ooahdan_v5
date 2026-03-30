# 가족 연동 & 다중 아이 프로필 — Supabase 마이그레이션 실행 가이드

## 적용되는 변경 사항 요약

| 항목 | 내용 |
|------|------|
| **babies** | `id`, `name`, `profile_image_url`, `created_at` |
| **family_connections** | `user_id`(auth.users), `baby_id`, `role`('admin'/'observer') |
| **invite_codes** | `code`, `baby_id`, `role`, `expires_at` |
| **words** | 기존 테이블에 `baby_id` 컬럼 추가 (NULL 허용 → 기존 데이터 유지) |
| **wordbooks** | 테이블 생성 + `baby_id`, wordbook_words N:M 테이블 |
| **archive_recordings** | 아카이브 기록 테이블 생성, `baby_id` (UPDATE로 이관 가능) |
| **RLS** | 위 테이블에 Row Level Security 및 정책 적용 |

---

## Supabase SQL Editor에서 실행하는 방법

### 1단계: Supabase 대시보드 접속

1. 브라우저에서 [https://supabase.com](https://supabase.com) 로그인
2. 해당 프로젝트(우아단) 선택

### 2단계: SQL Editor 열기

1. 왼쪽 사이드바에서 **SQL Editor** 클릭
2. **+ New query** 버튼 클릭 (새 쿼리 탭이 열림)

### 3단계: 마이그레이션 스크립트 붙여넣기

1. 프로젝트 내 파일  
   `supabase/migrations/001_family_and_baby_profiles.sql`  
   내용을 **전부 복사**
2. SQL Editor의 빈 입력 영역에 **붙여넣기** (Ctrl+V / Cmd+V)

### 4단계: 실행

1. 우측 하단 **Run** 버튼 클릭 (또는 Ctrl+Enter / Cmd+Enter)
2. 실행이 끝날 때까지 대기
3. 하단 **Results** / **Messages**에서 에러가 없는지 확인

### 5단계: 에러가 났을 때

- **"relation already exists"**  
  해당 테이블이 이미 있으면 `CREATE TABLE IF NOT EXISTS` 로 건너뛰므로, 같은 메시지가 나와도 대부분 무시해도 됨.
- **"column already exists"**  
  `baby_id`가 이미 추가된 상태면, 스크립트의 `DO $$ ... END $$` 블록이 자동으로 스킵함. 정상 동작.
- **"policy already exists"**  
  스크립트에서 `DROP POLICY IF EXISTS` 후 `CREATE POLICY`를 하므로, 같은 이름의 정책이 있으면 제거 후 다시 생성됨.  
  여전히 에러가 나면 Table Editor에서 해당 테이블 → Policies에서 기존 정책을 수동 삭제한 뒤, **7. RLS** 섹션만 다시 실행해 보세요.

---

## 마이그레이션 후 해야 할 일 (앱 쪽)

1. **기본 아이 생성**  
   로그인한 유저가 “우리 아이” 하나를 `babies`에 INSERT하고, `family_connections`에 본인 `user_id`와 그 `baby_id`, `role='admin'`으로 한 행 INSERT.

2. **기존 words 데이터에 baby_id 넣기 (선택)**  
   마이그레이션 후에도 기존 단어 행은 `baby_id = NULL`입니다.  
   “기본 아이”를 만들었다면, 그 아이로 묶으려면 한 번만 실행:
   ```sql
   UPDATE public.words SET baby_id = '<기본_아이_UUID>' WHERE baby_id IS NULL;
   ```

3. **앱 코드 수정**  
   - 단어/단어장/아카이브 조회·저장 시 현재 선택된 `baby_id`를 조건/값에 포함
   - 초대 코드 생성·입력 시 `invite_codes` INSERT/SELECT 및 `family_connections` INSERT

---

## 기록 이관 (형제에게 넘기기)

아카이브 기록을 다른 아이로 옮기려면:

```sql
UPDATE public.archive_recordings
SET baby_id = '<대상_아이_UUID>'
WHERE id = '<기록_UUID>';
```

`archive_recordings`에 걸린 RLS는 “현재 자신이 연결된 baby”만 보이게 하므로, 두 아이 모두에 연결된 유저(admin)만 위 UPDATE가 가능합니다.
