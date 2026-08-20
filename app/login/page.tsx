import { login, signup } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold">
          DETAIL AI
        </h1>

        <p className="mb-8 text-neutral-400">
          AI 상세페이지 제작 플랫폼
        </p>

        {params.error && (
          <div className="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">
            {params.error}
          </div>
        )}

        {params.message && (
          <div className="mb-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">
            {params.message}
          </div>
        )}

        <form className="space-y-4">
          <input
            name="name"
            placeholder="이름"
            className="w-full rounded-lg bg-neutral-800 p-3 outline-none"
          />

          <input
            name="email"
            type="email"
            required
            placeholder="이메일"
            className="w-full rounded-lg bg-neutral-800 p-3 outline-none"
          />

          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="비밀번호"
            className="w-full rounded-lg bg-neutral-800 p-3 outline-none"
          />

          <button
            formAction={login}
            className="w-full rounded-lg bg-white p-3 font-semibold text-black"
          >
            로그인
          </button>

          <button
            formAction={signup}
            className="w-full rounded-lg border border-neutral-600 p-3 font-semibold"
          >
            회원가입
          </button>
        </form>
      </div>
    </main>
  );
}