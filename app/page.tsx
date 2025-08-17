"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Clock,
  ArrowUp,
  CheckCircle,
  XCircle,
  Filter,
  Users,
  TrendingUp,
  Award,
  Target,
  Zap,
  Star,
  Trash2,
  ShieldCheck,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Toaster, toast } from "sonner"
import { MetaMaskConnector } from "@/components/metamask-connector"
import { RealtimeService } from "@/lib/realtime-service"
import Link from "next/link" // Import Link for navigation
import type { PromiseData, UserStats as User, GlobalStats, RealtimePayload } from "@/types" // Import types from central file
import { create } from "domain"

export default function PublicPromiseRegistry() {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [promises, setPromises] = useState<PromiseData[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [filter, setFilter] = useState<"all" | "my" | "active" | "completed" | "failed">("all")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [realtimeService] = useState(() => new RealtimeService())
  const [hasMounted, setHasMounted] = useState(false) // New state for hydration

  // Generate a unique session ID for "IP tracking" simulation
  // This effect ensures localStorage is only accessed on the client side
  const sessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionIdRef.current) {
      sessionIdRef.current = localStorage.getItem("sessionId")
      if (!sessionIdRef.current) {
        sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem("sessionId", sessionIdRef.current)
      }
    }
    setHasMounted(true) // Set hasMounted to true after initial render on client
  }, [])

  // Initialize real-time service and fetch initial data
  useEffect(() => {
    if (!sessionIdRef.current || !hasMounted) return // Ensure sessionId is set and component mounted before connecting

    realtimeService.connect(sessionIdRef.current) // Pass session ID on connect

    // Listen for real-time updates
    realtimeService.subscribeToChanges((payload: RealtimePayload) => {
      console.log("Realtime update:", payload);

      if (payload.eventType === "INSERT" && payload.new) {
        // add new promise
        setPromises((prev) => [payload.new, ...prev].filter(p => p !== undefined) as PromiseData[]);
      }

      if (payload.eventType === "UPDATE" && payload.new) {
        // update existing promise
        setPromises((prev) =>
          prev.map((p) => (payload.new && p.id === payload.new.id ? payload.new : p)).filter(p => p !== undefined) as PromiseData[]
        );
      }

      if (payload.eventType === "DELETE" && payload.old) {
        // remove deleted promise
        if (payload.old) {
          setPromises((prev) => prev.filter((p) => p.id !== payload.old!.id));
        }
      }
    });

    realtimeService.onStatsUpdate((stats) => {
      setGlobalStats(stats)
    })
    // ADD THIS NEW LISTENER
    realtimeService.onUserUpdate((updatedUser) => {
      // Only update the state if the update is for the currently logged-in user
      if (user && updatedUser.address.toLowerCase() === user.address.toLowerCase()) {
        console.log("Received a real-time update for the current user:", updatedUser);
        setUser(updatedUser);
      }
    });
    
    // Fetch initial promises and global stats from backend (simulated)
    const fetchInitialData = async () => {
      const initialPromises = await realtimeService.getInitialPromises()
      setPromises(initialPromises)
      const initialGlobalStats = await realtimeService.getGlobalStats() // Fetch initial global stats from backend
      setGlobalStats(initialGlobalStats)

      // Simulate fetching user data if wallet is already connected
      if (isConnected && user?.address) {
        console.log("🔄 Fetching initial user stats for connected wallet:", user.address)
        const userStats = await realtimeService.getUserStats(user.address, user.name || undefined)
        console.log("📊 Initial user stats loaded:", userStats)
        setUser((prev) => (prev ? { ...prev, ...userStats } : null))
      }
    }
    fetchInitialData()

    return () => {
      realtimeService.disconnect()
    }
  }, [realtimeService, isConnected, user?.address, sessionIdRef.current, hasMounted]) // Added hasMounted as dependency

  // Effect to handle showing the button after scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowBackToTop(true)
      } else {
        setShowBackToTop(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Function to scroll to the top smoothly
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  const handleWalletConnect = async (address: string) => {
    setIsConnected(true)
    console.log("🔗 Wallet connecting to address:", address)
    
    // Fetch user data from backend after connect
    const userStats = await realtimeService.getUserStats(address)
    console.log("📅 User stats loaded after wallet connect:", userStats)
    
    setUser(userStats)
    
    toast.success("🎉 Wallet Connected!", {
      description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
    })
    
    // Force refresh all data after connection
    console.log("🔄 Refreshing all data after wallet connection...")
    const refreshedPromises = await realtimeService.getInitialPromises()
    setPromises(refreshedPromises)
    
    const refreshedStats = await realtimeService.getGlobalStats()
    setGlobalStats(refreshedStats)
  }

const createPromise = async (formData: {
  creatorName: string;
  message: string;
  deadline: string;
  proof?: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}) => {
  if (!isConnected || !user?.address || !user.id) {
    toast.error("❌ Wallet Not Connected", { description: "Please connect your wallet first" });
    return;
  }

  try {
    // If user has no name and they provided one, update their profile
    if (!user.name && formData.creatorName) {
      await realtimeService.updateUserName(user.id, formData.creatorName);
    }

    const newPromiseData = {
      address: user.address,
      message: formData.message,
      deadline: new Date(formData.deadline).getTime(),
      status: "active" as const,
      proof: formData.proof,
      category: formData.category,
      difficulty: formData.difficulty,
      creatorName: formData.creatorName || user.name, // Use new name or existing name
    };

    await realtimeService.createPromise(newPromiseData as PromiseData);

    setIsCreateModalOpen(false);

    // Refresh all data to ensure UI is in sync
    const updatedPromises = await realtimeService.getInitialPromises();
    setPromises(updatedPromises);
    const updatedUserStats = await realtimeService.getUserStats(user.address, user.name || undefined);
    setUser(updatedUserStats);

    toast.success("🚀 Promise Created!", {
      description: "Your promise has been recorded.",
    });

  } catch (error: any) {
    console.error("Error creating promise:", error);
    toast.error("Failed to Create Promise", { description: error.message });
  }
};

  const updatePromiseStatus = async (promiseId: string, status: "completed" | "failed", proof?: string) => {
    if (!user?.address) {
      toast.error("❌ Wallet Not Authenticated", { description: "Please connect your wallet first" });
      return;
    }

    try {
      await realtimeService.updatePromiseStatus(promiseId, status, proof || "", user.address);
      

      const emoji = status === "completed" ? "🎉" : "😞";
      toast.success(`${emoji} Promise ${status === "completed" ? "Completed" : "Failed"}`, {
        description: "Status updated successfully. Reloading page.",
      });

      // Reload the page to reflect changes immediately
      window.location.reload();

    } catch (error: any) {
      console.error("Error updating promise status:", error);
      toast.error("Failed to Update Status", { description: error.message });
    }
  };

  const requestDeletePromise = async (promiseId: string) => {
    if (!isConnected || !user?.address) {
      toast.error("❌ Wallet Not Connected", { description: "Please connect your MetaMask wallet first." })
      return
    }

    const promiseToRequestDelete = promises.find((p) => p.id === promiseId)
    if (!promiseToRequestDelete) {
      toast.error("Promise not found.", { description: "Could not find the promise to request deletion." })
      return
    }

    // Ensure only the owner can request deletion
    if (promiseToRequestDelete.address.toLowerCase() !== user.address.toLowerCase()) {
      toast.error("Permission Denied", { description: "You can only request deletion for your own promises." })
      return
    }

    try {
      await realtimeService.requestDeletePromise(promiseId, user.address)
      toast.info("🗑️ Delete Request Sent", {
        description: "Your request has been sent to the admin for approval.",
      })
    } catch (error) {
      console.error("Error requesting delete:", error)
      toast.error("Failed to Send Delete Request", { description: "There was an error sending your request." })
    }
  }

  const filteredPromises = promises.filter((promise) => {
    if (filter === "my" && user?.address) {
      return promise.address.toLowerCase() === user.address.toLowerCase()
    }
    if (filter === "all") return true
    return promise.status === filter
  })

  const getTimeRemaining = (deadline: number) => {
    const now = Date.now()
    const remaining = deadline - now
    if (remaining <= 0) return "⏰ Expired"

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

    if (days > 0) return `🗓️ ${days}d ${hours}h`
    return `⏰ ${hours}h`
  }

  const getProgressPercentage = (promise: PromiseData) => {
  if (typeof promise.adminAdjustedProgress === "number") {
    return Math.min(100, Math.max(0, promise.adminAdjustedProgress));
  }
  
  // Check for valid date values before calculating
  if (!promise.createdAt || !promise.deadline || promise.deadline <= promise.createdAt) {
    // If deadline has already passed, show 100%, otherwise 0%
    return promise.deadline < Date.now() ? 100 : 0; 
  }

  const now = Date.now();
  const total = promise.deadline - promise.createdAt;
  const elapsed = now - promise.createdAt;
  
  // Final safety check to prevent division by zero
  if (total <= 0) {
    return 100;
  }
  
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
};
  const getCategoryColor = (category: string) => {
    const colors = {
      Learning: "bg-gradient-to-r from-purple-500 to-pink-500",
      Health: "bg-gradient-to-r from-green-500 to-emerald-500",
      Personal: "bg-gradient-to-r from-blue-500 to-cyan-500",
      Business: "bg-gradient-to-r from-orange-500 to-red-500",
      Creative: "bg-gradient-to-r from-yellow-500 to-orange-500",
    }
    return colors[category as keyof typeof colors] || "bg-gradient-to-r from-gray-500 to-gray-600"
  }

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
        <p className="ml-4 text-lg">Loading application...</p>
      </div>
    )
  }

  // In PublicPromiseRegistry component, add this new function
  const updatePromiseDetails = async (promiseId: string, updates: Partial<PromiseData>) => {
    if (!isConnected || !user?.address) {
      toast.error("❌ Wallet Not Connected", { description: "Please connect your MetaMask wallet first" })
      return
    }

    try {
      await realtimeService.updatePromiseDetails(promiseId, updates, user.address)
      // The `onPromiseUpdate` listener will update `promises` state
      toast.success("📝 Promise Updated", {
        description: "Your promise details have been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating promise details:", error)
      toast.error("Failed to Update Promise", { description: "There was an error updating your promise." })
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8"
        >
          <div className="mb-8">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Promise Registry Logo"
                className="w-16 h-16 md:w-20 md:h-20 object-contain"
              />
              <h1 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent text-3xl md:text-4xl font-bold">
                Promise Registry
              </h1>
            </div>
            <p className="text-cyan-300 mt-3 text-base md:text-lg ml-0 md:ml-20">
              Commit to your goals on the blockchain ⛓️
            </p>
          </div>

          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center">
            {/* {user && isConnected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-right bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-xl"
              >
                <p className="text-sm text-purple-200">Reputation Score</p>
                <p className="text-3xl font-bold text-yellow-300">⭐ {user.reputation}</p>
                <p className="text-xs text-purple-200">
                  Level {user.level} • {user.streak} streak 🔥
                </p>
              </motion.div>
            )} */}

            <MetaMaskConnector onConnect={handleWalletConnect} isConnected={isConnected} />
            <Link href="/admin" passHref>
              <Button variant="outline" className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600">
                <ShieldCheck className="w-4 h-4 mr-2" /> Admin Panel
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Global Stats */}
        {globalStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
          <Card className="bg-gradient-to-r from-cyan-600 to-blue-600 border-0 text-white h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">👥 Total Users</CardTitle>
                <Users className="w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{globalStats.totalUsers.toLocaleString()}</p>
              <p className="text-sm opacity-80">Total registered users</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-600 to-pink-600 border-0 text-white h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">🎯 Total Promises</CardTitle>
                <Target className="w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{promises.length}</p>
              <p className="text-sm opacity-80">Across the network</p>
            </CardContent>
          </Card>

            <Card className="bg-gradient-to-r from-green-600 to-emerald-600 border-0 text-white  h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">📈 Success Rate</CardTitle>
                <TrendingUp className="w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-2xl font-bold">
                {(() => {
                  const total = promises.length;
                  const completed = promises.filter(p => p.status === 'completed').length;
                  const rate = total > 0 ? (completed / total) * 100 : 0;
                  return `${rate.toFixed(2)}%`;
                })()}
              </p>
              <p className="text-sm opacity-80">Of all promises</p>
            </CardContent>
          </Card>

            {/* <Card className="bg-gradient-to-r from-yellow-600 to-orange-600 border-0 text-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Avg Reputation</CardTitle>
                  <Award className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{globalStats.averageReputation.toFixed(2)}</p>
              </CardContent>
            </Card> */}

            <Card className="bg-gradient-to-r from-pink-600 to-red-600 border-0 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">⭐ Top Performer</CardTitle>
                <Star className="w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-2xl font-bold truncate">
                {globalStats.topPerformer || "N/A"}
              </p>
              <p className="text-sm opacity-80">Highest reputation</p>
            </CardContent>
          </Card>
          </motion.div>
        )}

        {/* User Stats */}
        {user && isConnected && globalStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <Card className="bg-gradient-to-r from-green-500 to-emerald-500 border-0 text-white flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">✅ Completed</CardTitle>
                  <CheckCircle className="w-6 h-6" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">{promises.filter((p) => p.status === "completed").length}</p>
                <p className="text-sm opacity-80">Across the network</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-red-500 to-pink-500 border-0 text-white flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">❌ Failed</CardTitle>
                  <XCircle className="w-6 h-6" />
                </div>
              </CardHeader>
              <CardContent>
                <p className=" text-2xl md:text-3xl font-bold">{promises.filter((p) => p.status === "failed").length}</p>
                <p className="text-sm opacity-80">Across the network</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-cyan-500 border-0 text-white flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">⏳ Active</CardTitle>
                  <Clock className="w-6 h-6" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">{promises.filter((p) => p.status === "active").length}</p>
                <p className="text-sm opacity-80">In progress</p>
              </CardContent>
            </Card>
          </motion.div>
        )}    
          
        

        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full max-w-full">
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white backdrop-blur-sm">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Promises" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white w-full max-w-[90vw]">
                <SelectItem value="all">All Promises</SelectItem>
                {user && isConnected && <SelectItem value="my">My Promises</SelectItem>}
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg"
                disabled={!isConnected} // Disable if not connected
              >
                <Plus className="w-5 h-5 mr-2" />✨ Create Promise
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-purple-500/50 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl md:text-2xl  bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Create New Promise
                </DialogTitle>
                <DialogDescription className="text-gray-300">
                  Make a public commitment that will be recorded on the blockchain
                </DialogDescription>
              </DialogHeader>
              <CreatePromiseForm onSubmit={createPromise} isConnected={isConnected} user={user} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Promises Grid */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromises.map((promise) => (
            <PromiseCard
              key={promise.id}
              promise={promise}
              onUpdateStatus={updatePromiseStatus}
              onRequestDelete={requestDeletePromise}
              onUpdateDetails={updatePromiseDetails} // Pass the new handler
              currentUserAddress={user?.address}
              getTimeRemaining={getTimeRemaining}
              getProgressPercentage={getProgressPercentage}
              getCategoryColor={getCategoryColor}
              isConnected={isConnected} // Pass isConnected
            />
          ))}
        </motion.div>

        {filteredPromises.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <p className="text-gray-300 text-xl">🔍 No promises found for the selected filter</p>
          </motion.div>
        )}
      </div>
      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <Button
              onClick={scrollToTop}
              className="h-14 w-14 rounded-full p-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              aria-label="Back to top"
            >
              <ArrowUp className="h-8 w-8" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster theme="dark" />
    </div>
  )
}

function CreatePromiseForm({ onSubmit, isConnected, user }: { onSubmit: (data: any) => void; isConnected: boolean; user: User | null }) {
  const [formData, setFormData] = useState({
    creatorName: "",
    message: "",
    deadline: "",
    proof: "",
    category: "Personal",
    difficulty: "medium" as "easy" | "medium" | "hard",
  })
  const [isSubmitting, setIsSubmitting] = useState(false) // New state for submission

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected) {
      toast.error("Wallet Not Connected", { description: "Please connect your MetaMask wallet first." })
      return
    }
    if (formData.message.length > 200) {
      toast.error("Message Too Long", { description: "Promise message cannot exceed 200 characters." })
      return
    }
    if (new Date(formData.deadline) <= new Date()) {
      toast.error("Invalid Deadline", { description: "Deadline must be in the future." })
      return
    }

    setIsSubmitting(true) // Disable button and fields
    try {
      await onSubmit(formData)
      setFormData({ creatorName: "", message: "", deadline: "", proof: "", category: "Personal", difficulty: "medium" })
    } finally {
      setIsSubmitting(false) // Re-enable button and fields
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!user?.name && (
        <div>
          <Label htmlFor="creatorName" className="text-purple-300">
            Your Name
          </Label>
          <Input
            id="creatorName"
            value={formData.creatorName}
            onChange={(e) => setFormData((prev) => ({ ...prev, creatorName: e.target.value }))}
            placeholder="Enter your name or nickname"
            className="bg-gray-800 border-purple-500/50 text-white placeholder:text-gray-400"
            required
            disabled={isSubmitting}
          />
        </div>
      )}
      <div>
        <Label htmlFor="message" className="text-purple-300">
          Promise Description
        </Label>
        <Textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          placeholder="What do you promise to achieve? 🎯"
          maxLength={200}
          className="bg-gray-800 border-purple-500/50 text-white placeholder:text-gray-400"
          required
          disabled={isSubmitting} // Disable while submitting
        />
        <p className="text-sm text-gray-400 mt-1">{formData.message.length}/200 characters</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category" className="text-purple-300">
            Category
          </Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
            disabled={isSubmitting} // Disable while submitting
          >
            <SelectTrigger className="bg-gray-800 border-purple-500/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="Learning">📚 Learning</SelectItem>
              <SelectItem value="Health">💪 Health</SelectItem>
              <SelectItem value="Personal">🌟 Personal</SelectItem>
              <SelectItem value="Business">💼 Business</SelectItem>
              <SelectItem value="Creative">🎨 Creative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="difficulty" className="text-purple-300">
            Difficulty
          </Label>
          <Select
            value={formData.difficulty}
            onValueChange={(value: any) => setFormData((prev) => ({ ...prev, difficulty: value }))}
            disabled={isSubmitting} // Disable while submitting
          >
            <SelectTrigger className="bg-gray-800 border-purple-500/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="easy">🟢 Easy</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="hard">🔴 Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="deadline" className="text-purple-300">
          Deadline
        </Label>
        <Input
          id="deadline"
          type="datetime-local"
          value={formData.deadline}
          onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
          className="bg-gray-800 border-purple-500/50 text-white"
          required
          disabled={isSubmitting} // Disable while submitting
        />
      </div>

      <div>
        <Label htmlFor="proof" className="text-purple-300">
          Proof URL (Optional)
        </Label>
        <Input
          id="proof"
          type="url"
          value={formData.proof}
          onChange={(e) => setFormData((prev) => ({ ...prev, proof: e.target.value }))}
          placeholder="https://github.com/user/project 🔗"
          className="bg-gray-800 border-purple-500/50 text-white placeholder:text-gray-400"
          disabled={isSubmitting} // Disable while submitting
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-xl"
        disabled={!isConnected || isSubmitting} // Disable if not connected or submitting
      >
        {isSubmitting ? "Creating Promise..." : "🚀 Create Promise"}
      </Button>
    </form>
  )
}

// In PromiseCard component, add new state for edit modal
// Add new prop for onUpdateDetails
interface PromiseCardProps {
  promise: PromiseData
  onUpdateStatus: (id: string, status: "completed" | "failed", proof?: string) => void
  onRequestDelete: (id: string) => void
  onUpdateDetails: (id: string, updates: Partial<PromiseData>) => void // New prop
  currentUserAddress?: string
  getTimeRemaining: (deadline: number) => string
  getProgressPercentage: (promise: PromiseData) => number
  getCategoryColor: (category: string) => string
  isConnected: boolean // Pass isConnected prop
}

// Update PromiseCard function signature
function PromiseCard({
  promise,
  onUpdateStatus,
  onRequestDelete,
  onUpdateDetails, // Destructure new prop
  currentUserAddress,
  getTimeRemaining,
  getProgressPercentage,
  getCategoryColor,
  isConnected, // Destructure new prop
}: PromiseCardProps) {
  const [updateProof, setUpdateProof] = useState(promise.proof || ""); // <-- ADD THIS LINE
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isDeleteRequestConfirmOpen, setIsDeleteRequestConfirmOpen] = useState(false)
  // In PromiseCard component, add new state for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const handleStatusUpdate = (status: "completed" | "failed") => {
    onUpdateStatus(promise.id, status, updateProof)
    setIsUpdateModalOpen(false)
  }

  const handleRequestDeleteClick = () => {
    setIsDeleteRequestConfirmOpen(true)
  }

  const handleConfirmRequestDelete = () => {
    onRequestDelete(promise.id)
    setIsDeleteRequestConfirmOpen(false)
  }

  const getStatusIcon = () => {
    switch (promise.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case "failed":
        return <XCircle className="w-5 h-5 text-red-400" />
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />
    }
  }

  const getStatusColor = () => {
    switch (promise.status) {
      case "completed":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
      case "failed":
        return "bg-gradient-to-r from-red-500 to-pink-500"
      default:
        return "bg-gradient-to-r from-yellow-500 to-orange-500"
    }
  }

  const getDifficultyEmoji = () => {
    switch (promise.difficulty) {
      case "easy":
        return "🟢"
      case "medium":
        return "🟡"
      case "hard":
        return "🔴"
    }
  }

  // Check if the current user is the owner of the promise
  const isOwner = currentUserAddress?.toLowerCase() === promise.address.toLowerCase()

  const handleUpdateDetails = async (updates: Partial<PromiseData>) => {
    await onUpdateDetails(promise.id, updates)
    setIsEditModalOpen(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-white/10 backdrop-blur-sm border-white/20 h-full hover:bg-white/15 transition-all duration-300">
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <Badge className={`${getStatusColor()} text-white border-0`}>
              {getStatusIcon()}
              <span className="ml-1 capitalize">{promise.status}</span>
            </Badge>
            <div className="text-right">
              <p className="text-xs text-gray-300">{getTimeRemaining(promise.deadline)}</p>
              <p className="text-xs text-gray-400">
                {getDifficultyEmoji()} {promise.difficulty}
              </p>
            </div>
          </div>

          <div className={`w-full h-1 rounded-full ${getCategoryColor(promise.category)} mb-3`}></div>

          <CardTitle className="text-lg text-white break-all">{promise.message}</CardTitle>
          <CardDescription className="text-gray-300 break-all">
            👤 {promise.creatorName || 'Unknown'} • {promise.category}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {promise.proof && (
            <div>
              <p className="text-sm text-gray-300 mb-1">🔗 Proof:</p>
              <a
                href={promise.proof}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-sm break-all underline"
              >
                {promise.proof}
              </a>
            </div>
          )}

          {promise.status === "active" && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Progress</span>
                <span className="text-cyan-400">{Math.round(getProgressPercentage(promise))}%</span>
              </div>
              <Progress value={getProgressPercentage(promise)} className="h-2 bg-gray-700" />
            </div>
          )}

          {promise.status === "active" &&
            isOwner && ( // Only show update status if active AND owner
              <>
                {/* ... existing Update Status Dialog ... */}

                <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full border-purple-500/50 hover:bg-purple-500/20 bg-transparent text-white"
                    >
                      ⚡ Update Status
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-purple-500/50 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Update Promise Status
                      </DialogTitle>
                      <DialogDescription className="text-gray-300">
                        Mark this promise as completed or failed
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="update-proof" className="text-purple-300">
                          Proof URL (Optional)
                        </Label>
                        <Input
                          id="update-proof"
                          type="url"
                          value={updateProof} // Set the value
                          onChange={(e) => setUpdateProof(e.target.value)} // Update the state on change
                          placeholder="https://github.com/user/project 🔗"
                          className="bg-gray-800 border-purple-500/50 text-white placeholder:text-gray-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleStatusUpdate("completed")}
                          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />✅ Completed
                        </Button>
                        <Button
                          onClick={() => handleStatusUpdate("failed")}
                          className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
                        >
                          <XCircle className="w-4 h-4 mr-2" />❌ Failed
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full border-blue-500/50 hover:bg-blue-500/20 bg-transparent text-blue-400"
                    >
                      ✏️ Edit Promise
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-blue-500/50 text-white max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-2xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        Edit Promise
                      </DialogTitle>
                      <DialogDescription className="text-gray-300">
                        Update the details of your active promise.
                      </DialogDescription>
                    </DialogHeader>
                    <EditPromiseForm
                      promise={promise}
                      onSubmit={handleUpdateDetails}
                      isConnected={isConnected}
                      onClose={() => setIsEditModalOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </>
            )}

          {isOwner && (
            <Button
              variant="outline"
              className="w-full border-red-500/50 hover:bg-red-500/20 bg-transparent text-red-400"
              onClick={handleRequestDeleteClick}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Request Delete
            </Button>
          )}

          {/* Delete Request Confirmation Dialog */}
          <Dialog open={isDeleteRequestConfirmOpen} onOpenChange={setIsDeleteRequestConfirmOpen}>
            <DialogContent className="bg-gray-900 border-red-500/50 text-white max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-xl bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent flex items-center">
                  <Trash2 className="w-6 h-6 mr-2 text-red-400" /> Confirm Delete Request
                </DialogTitle>
                <DialogDescription className="text-gray-300">
                  Are you sure you want to request deletion for this promise? An admin will review your request.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteRequestConfirmOpen(false)}
                  className="border-gray-600 hover:bg-gray-800 bg-transparent text-white"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmRequestDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Send Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function EditPromiseForm({
  promise,
  onSubmit,
  isConnected,
  onClose,
}: {
  promise: PromiseData
  onSubmit: (data: any) => void
  isConnected: boolean
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    message: promise.message,
    deadline: new Date(promise.deadline).toISOString().slice(0, 16), // Format for datetime-local input
    proof: promise.proof || "",
    category: promise.category,
    difficulty: promise.difficulty,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected) {
      toast.error("Wallet Not Connected", { description: "Please connect your MetaMask wallet first." })
      return
    }
    if (formData.message.length > 200) {
      toast.error("Message Too Long", { description: "Promise message cannot exceed 200 characters." })
      return
    }
    if (new Date(formData.deadline) <= new Date()) {
      toast.error("Invalid Deadline", { description: "Deadline must be in the future." })
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        ...formData,
        deadline: new Date(formData.deadline).getTime(), // Convert back to timestamp
      })
      onClose() // Close modal on success
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-message" className="text-purple-300">
          Promise Description
        </Label>
        <Textarea
          id="edit-message"
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          maxLength={200}
          className="bg-gray-800 border-purple-500/50 text-white placeholder:text-gray-400"
          required
          disabled={isSubmitting}
        />
        <p className="text-sm text-gray-400 mt-1">{formData.message.length}/200 characters</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edit-category" className="text-purple-300">
            Category
          </Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
            disabled={isSubmitting}
          >
            <SelectTrigger className="bg-gray-800 border-purple-500/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="Learning">📚 Learning</SelectItem>
              <SelectItem value="Health">💪 Health</SelectItem>
              <SelectItem value="Personal">🌟 Personal</SelectItem>
              <SelectItem value="Business">💼 Business</SelectItem>
              <SelectItem value="Creative">🎨 Creative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="edit-difficulty" className="text-purple-300">
            Difficulty
          </Label>
          <Select
            value={formData.difficulty}
            onValueChange={(value: any) => setFormData((prev) => ({ ...prev, difficulty: value }))}
            disabled={isSubmitting}
          >
            <SelectTrigger className="bg-gray-800 border-purple-500/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="easy">🟢 Easy</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="hard">🔴 Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="edit-deadline" className="text-purple-300">
          Deadline
        </Label>
        <Input
          id="edit-deadline"
          type="datetime-local"
          value={formData.deadline}
          onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
          className="bg-gray-800 border-purple-500/50 text-white"
          required
          disabled={isSubmitting}
        />
      </div>

      <div>
        <Label htmlFor="edit-proof" className="text-purple-300">
          Proof URL (Optional)
        </Label>
        <Input
          id="edit-proof"
          type="url"
          value={formData.proof}
          onChange={(e) => setFormData((prev) => ({ ...prev, proof: e.target.value }))}
          placeholder="https://github.com/user/project 🔗"
          className="bg-gray-800 border-purple-500/50 text-white placeholder:text-gray-400"
          disabled={isSubmitting}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-xl"
        disabled={!isConnected || isSubmitting}
      >
        {isSubmitting ? "Saving Changes..." : "💾 Save Changes"}
      </Button>
    </form>
  )
}
