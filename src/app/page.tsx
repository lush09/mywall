"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

interface Post {
  id: string;
  author_id: string;
  message: string;
  created_at: string;
  photo_url?: string | null;
}

export default function Wall() {
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPosts(0);
    // Subscribe to new posts
    const channel = supabase
      .channel("public:posts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          setPosts((prev) => [payload.new as Post, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPosts(pageNum: number) {
    setLoading(true);
    const pageSize = 10;
    const from = pageNum * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) setError("Failed to load posts");
    if (data && data.length > 0) {
      setPosts((prev) => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = (data as Post[]).filter(post => !existingIds.has(post.id));
        return pageNum === 0 ? data as Post[] : [...prev, ...newPosts];
      });
      setHasMore(data.length === pageSize);
    } else {
      setHasMore(false);
    }
    setLoading(false);
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage);
  }

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || message.length > 280) return;
    setSubmitting(true);
    let photoUrl = null;
    if (photo) {
      const fileExt = photo.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('post-photos').upload(fileName, photo);
      if (uploadError) {
        setError('Failed to upload photo');
        setSubmitting(false);
        return;
      }
      photoUrl = supabase.storage.from('post-photos').getPublicUrl(fileName).data.publicUrl;
    }
    const { error } = await supabase.from("posts").insert([
      { author_id: "anonymous", message, photo_url: photoUrl },
    ]);
    if (!error) {
      setMessage("");
      setPhoto(null);
    } else setError("Failed to post!");
    textareaRef.current?.focus();
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-white p-3 font-sans flex flex-col">
      {/* Header */}
      <header className="w-full bg-blue-500 py-3 px-6 flex rounded-t-lg items-center">
        <span className="text-white text-xl font-bold tracking-wide">wall</span>
      </header>
      <main className="flex flex-1 flex-col md:flex-row min-h-0">
        {/* Sidebar */}
        <aside className="w-full md:w-80 flex-shrink-0 py-6 px-8 flex flex-col items-center bg-white">
          <img
            src="/toga.jpg"
            alt="Profile Image"
            className="w-[100%] max-w-xs aspect-square rounded-md object-cover mb-4 mx-auto"
          />
          <div className="w-full flex flex-col items-start">
            <div className="text-2xl font-bold mb-1 text-gray-800 text-left">Shigeru Houshi</div>
            <div className="text-gray-500 mb-7 font-semibold text-left">wall</div>
            <button className="mb-4 px-2 py-3 border font-bold border-gray-300 rounded bg-gray-100 text-gray-700 text-sm text-left w-full">Information</button>
          </div>
          <div className="w-full text-left text-sm text-gray-700">
            <div className="mb-2">
              <span className="font-semibold text-gray-800">Networks</span>
              <br />Columban College Inc.
            </div>
            <div>
              <span className="font-semibold text-gray-800">Current City</span>
              <br />Manila, Philippines
            </div>
          </div>
        </aside>
        {/* Separator */}
        <div className="hidden md:block w-px bg-gray-300 my-8" />
        {/* Main Wall */}
        <section className="flex-1 flex flex-col gap-6 px-2 md:px-8 py-8 min-w-0">
          {/* Wall Input */}
          <form onSubmit={handleShare} className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={280}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full border-2 border-dashed border-gray-300 rounded-sm p-3 text-base resize-none focus:outline-none focus:border-blue-400 bg-blue-50 placeholder:text-gray-600 text-gray-700"
              disabled={loading}
            />
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm ${message.length > 280 ? 'text-red-500' : 'text-gray-400'}`}>{280 - message.length} characters remaining</span>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <label htmlFor="photo-upload" className={`px-4 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-200'}`}
                aria-disabled={submitting}
              >
                Choose Photo
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={e => !submitting && setPhoto(e.target.files ? e.target.files[0] : null)}
                className="hidden"
                disabled={submitting}
              />
            </div>
            {photo && (
              <div className="mb-2 relative w-20 h-20">
                <img src={URL.createObjectURL(photo)} alt="Preview" className="w-20 h-20 object-cover rounded" />
                <button
                  type="button"
                  onClick={() => !submitting && setPhoto(null)}
                  className={`absolute top-0 right-0 bg-white bg-opacity-80 rounded-full p-1 text-gray-700 transition-colors shadow ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100 hover:text-red-600'}`}
                  aria-label="Remove photo preview"
                  style={{ transform: 'translate(35%,-35%)' }}
                  disabled={submitting}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!message.trim() || message.length > 280 || submitting}
                className="bg-blue-500 text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-40 flex items-center justify-center min-w-[80px]"
              >
                {submitting ? (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                ) : null}
                Share
              </button>
            </div>
          </form>
          {/* Feed */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 max-h-[60vh] overflow-y-auto px-3">
            {/* Posts Feed */}
            {loading ? (
              <div className="text-gray-800">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="text-gray-800">No posts yet. Be the first!</div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="border-b last:border-b-0 border-gray-200 pb-3 mb-3 last:mb-0 last:pb-0">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-gray-800">Shigeru Houshi</span>
                    <span className="text-xs text-gray-800 font-normal ml-2 whitespace-nowrap">{formatRelativeTime(post.created_at)}</span>
                  </div>
                  <div className="text-base mt-1 mb-1 whitespace-pre-line text-gray-800">{post.message}</div>
                  {post.photo_url && (
                    <img src={post.photo_url} alt="Post Photo" className="mt-2 rounded max-h-60 object-contain" />
                  )}
                </div>
              ))
            )}
            {error && <div className="text-red-500 mt-2">{error}</div>}
            {hasMore && !loading && (
              <button
                onClick={handleLoadMore}
                className="mt-2 px-4 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm mx-auto"
              >
                Load more
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );

  // --- Helpers ---
  function formatRelativeTime(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  }
}
