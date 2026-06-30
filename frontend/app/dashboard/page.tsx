"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchMe(token);
    fetchTasks(token);
    fetchUsers(token);

    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          fetchTasks(token);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchMe = async (token: string) => {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setUser(await res.json());
    } else {
      localStorage.removeItem("token");
      router.push("/");
    }
  };

  const fetchTasks = async (token: string) => {
    const res = await fetch(`${API_URL}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  };

  const fetchUsers = async (token: string) => {
    const res = await fetch(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setUsers(await res.json());
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        description,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
      }),
    });

    if (res.ok) {
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setDueDate("");
      setShowForm(false);
      fetchTasks(token);
    }
  };

  const handleMarkComplete = async (taskId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "completed" }),
    });

    if (res.ok) fetchTasks(token);
  };

  const handleDeleteTask = async (taskId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) fetchTasks(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const found = users.find((u) => u.id === userId);
    return found ? found.full_name : "Unknown";
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  const statusBadge = (status: string) => {
    if (status === "completed")
      return { label: "Completed", bg: "#0F6E56", fg: "#9FE1CB" };
    if (status === "in_progress")
      return { label: "In progress", bg: "#854F0B", fg: "#FAC775" };
    return { label: "To do", bg: "#3C3489", fg: "#CECBF6" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B0B0E]">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0B0B0E] text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-xl font-medium text-black dark:text-white">
              Hairdrama Tasks
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"} total
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              {darkMode ? "Light mode" : "Dark mode"}
            </button>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="avatar"
                className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs">
                {getInitials(user?.full_name || "")}
              </div>
            )}
            <span className="text-sm text-zinc-700 dark:text-zinc-300 hidden sm:block">
              {user?.full_name}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            All tasks
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg font-medium hover:opacity-80 transition"
          >
            {showForm ? "Cancel" : "+ New task"}
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-[#16161B] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-8">
            <form onSubmit={handleCreateTask} className="space-y-4">
              <input
                type="text"
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-[#0B0B0E] border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600"
              />
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-50 dark:bg-[#0B0B0E] border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-[#0B0B0E] border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600"
                >
                  <option value="">Assign to...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-[#0B0B0E] border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600"
                />
              </div>
              <button
                type="submit"
                className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-80 transition"
              >
                Create task
              </button>
            </form>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl">
            <p className="text-zinc-500 text-sm">
              No tasks yet. Create your first one above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => {
              const badge = statusBadge(task.status);
              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-[#16161B] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: badge.bg, color: badge.fg }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="font-medium text-black dark:text-white mb-1.5 leading-snug">
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
                      <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-700 dark:text-zinc-300">
                        {getInitials(getUserName(task.assigned_to))}
                      </div>
                      <span>{getUserName(task.assigned_to)}</span>
                      {task.due_date && (
                        <>
                          <span className="text-zinc-400 dark:text-zinc-700">•</span>
                          <span>{task.due_date}</span>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {task.status !== "completed" && (
                        <button
                          onClick={() => handleMarkComplete(task.id)}
                          className="flex-1 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-2 rounded-lg transition"
                        >
                          Mark complete
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-xs text-zinc-500 hover:text-red-500 dark:hover:text-red-400 px-3 py-2 rounded-lg transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}