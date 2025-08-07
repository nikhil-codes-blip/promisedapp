"use client"

import { Label } from "@/components/ui/label"

import { CardContent } from "@/components/ui/card"

import { CardDescription } from "@/components/ui/card"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardTitle } from "@/components/ui/card"
import { CardHeader } from "@/components/ui/card"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Loader2 } from 'lucide-react'
import { ShieldCheck } from 'lucide-react'
import { Trash2 } from 'lucide-react'
import { CheckCircle } from 'lucide-react'
import { XCircle } from 'lucide-react'
import { Target } from 'lucide-react'
import { Users } from 'lucide-react'
import { Globe } from 'lucide-react'
import { toast } from "sonner"
import { RealtimeService } from "@/lib/realtime-service"
import type { PromiseData, UserData, SessionData, DeleteRequest } from "@/types" // Import types from central file

export default function AdminPage() {
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([])
  const [allUsers, setAllUsers] = useState<UserData[]>([])
  const [allSessions, setAllSessions] = useState<SessionData[]>([])
  const [allPromises, setAllPromises] = useState<PromiseData[]>([]) // New state for all promises
  const [adminAddress, setAdminAddress] = useState<string>("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [realtimeService] = useState(() => new RealtimeService()) // Instantiate RealtimeService

  const fetchAllUsers = useCallback(async (currentAdminAddress: string) => {
    if (!currentAdminAddress) return
    try {
      const users = await realtimeService.getAllUsers(currentAdminAddress)
      // Map to UserData interface, adjusting property names if necessary
      setAllUsers(
        users.map((u: any) => ({
          address: u.address,
          reputation: u.reputation,
          completed_promises: u.completed_promises,
          failed_promises: u.failed_promises,
          total_promises: u.total_promises,
          streak: u.streak,
          level: u.level,
          joined_at: u.joined_at,
          last_active: u.last_active,
        })),
      )
    } catch (error) {
      console.error("Error fetching all users:", error)
      toast.error("Failed to fetch user data", { description: "Check admin address or API status." })
    }
  }, [realtimeService])

  const fetchAllSessions = useCallback(async (currentAdminAddress: string) => {
    if (!currentAdminAddress) return
    try {
      const sessions = await realtimeService.getAllSessions(currentAdminAddress)
      // Map to SessionData interface, adjusting property names if necessary
      setAllSessions(
        sessions.map((s: any) => ({
          session_id: s.session_id,
          ip: s.ip,
          last_active: s.last_active,
          first_visit: s.first_visit,
        })),
      )
    } catch (error) {
      console.error("Error fetching all sessions:", error)
      toast.error("Failed to fetch session data", { description: "Check admin address or API status." })
    }
  }, [realtimeService])

  const fetchAllPromises = useCallback(async (currentAdminAddress: string) => {
    if (!currentAdminAddress) return
    try {
      const promises = await realtimeService.getAllPromises(currentAdminAddress)
      setAllPromises(promises)
    } catch (error) {
      console.error("Error fetching all promises:", error)
      toast.error("Failed to fetch promise data", { description: "Check admin address or API status." })
    }
  }, [realtimeService])

  const checkAdminAuth = useCallback(async (address: string) => {
    if (!address) return false
    setIsLoading(true)
    try {
      // Use the new API route for admin delete requests
      const requests = await realtimeService.getAdminDeleteRequests(address.toLowerCase())
      setDeleteRequests(requests)
      setIsAuthenticated(true)
      toast.success("Admin Authenticated", { description: "Welcome to the Admin Panel!" })
      await fetchAllUsers(address.toLowerCase())
      await fetchAllSessions(address.toLowerCase())
      await fetchAllPromises(address.toLowerCase()) // Fetch all promises on auth
      return true
    } catch (error: any) {
      console.error("Admin auth check failed:", error)
      setIsAuthenticated(false)
      toast.error("Authentication Failed", {
        description: error.message || "Invalid Admin Address or API connection error.",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [realtimeService, fetchAllUsers, fetchAllSessions, fetchAllPromises])

  useEffect(() => {
    const storedAdminAddress = localStorage.getItem("adminAddress")
    if (storedAdminAddress) {
      setAdminAddress(storedAdminAddress)
      checkAdminAuth(storedAdminAddress)
    }

    // Subscribe to real-time promise updates for the admin panel
    const unsubscribePromiseUpdate = realtimeService.onPromiseUpdate((updatedPromise) => {
      setAllPromises((prevPromises) =>
        prevPromises.map((p) => (p.id === updatedPromise.id ? updatedPromise : p))
      )
    })

    // Clean up subscription on component unmount
    return unsubscribePromiseUpdate
  }, [realtimeService, checkAdminAuth]) // Dependency on realtimeService

  const handleLogin = async () => {
    if (!adminAddress) {
      toast.error("Admin Address Required", { description: "Please enter the admin wallet address." })
      return
    }
    localStorage.setItem("adminAddress", adminAddress.toLowerCase())
    await checkAdminAuth(adminAddress.toLowerCase())
  }

  const handleLogout = () => {
    localStorage.removeItem("adminAddress")
    setAdminAddress("")
    setIsAuthenticated(false)
    setDeleteRequests([])
    setAllUsers([])
    setAllSessions([])
    setAllPromises([]) // Clear promises on logout
    toast.info("Logged Out", { description: "You have been logged out from the Admin Panel." })
  }

  const fetchDeleteRequests = async (currentAdminAddress: string) => {
    if (!currentAdminAddress) return
    setIsLoading(true)
    try {
      const requests = await realtimeService.getAdminDeleteRequests(currentAdminAddress)
      setDeleteRequests(requests)
    } catch (error) {
      console.error("Error fetching delete requests:", error)
      toast.error("Failed to fetch requests", { description: "Check admin address or API status." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    if (!isAuthenticated || !adminAddress) return
    setIsLoading(true)
    try {
      await realtimeService.approveDeleteRequest(requestId, adminAddress.toLowerCase())
      toast.success("Request Approved", { description: "Promise deleted successfully." })
      fetchDeleteRequests(adminAddress.toLowerCase())
      fetchAllUsers(adminAddress.toLowerCase())
      fetchAllPromises(adminAddress.toLowerCase()) // Refresh all promises after deletion
    } catch (error: any) {
      console.error("Error approving request:", error)
      toast.error("Approval Failed", { description: error.message || "Unknown error." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async (requestId: string) => {
    if (!isAuthenticated || !adminAddress) return
    setIsLoading(true)
    try {
      await realtimeService.rejectDeleteRequest(requestId, adminAddress.toLowerCase())
      toast.info("Request Rejected", { description: "Delete request has been rejected." })
      fetchDeleteRequests(adminAddress.toLowerCase())
    } catch (error: any) {
      console.error("Error rejecting request:", error)
      toast.error("Rejection Failed", { description: error.message || "Unknown error." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdatePromiseProgress = async (promiseId: string, progress: number) => {
    if (!isAuthenticated || !adminAddress) return
    if (progress < 0 || progress > 100) {
      toast.error("Invalid Progress", { description: "Progress must be between 0 and 100." })
      return
    }
    setIsLoading(true)
    try {
      await realtimeService.updateAdminPromiseProgress(promiseId, progress, adminAddress.toLowerCase())
      toast.success("Progress Updated", {
        description: `Promise ${promiseId.slice(0, 8)}... progress set to ${progress}%`,
      })
      fetchAllPromises(adminAddress.toLowerCase()) // Refresh all promises to show update
    } catch (error: any) {
      console.error("Error updating promise progress:", error)
      toast.error("Progress Update Failed", { description: error.message || "Unknown error." })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center p-4">
        <Card className="bg-gray-900 border-purple-500/50 text-white max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center">
              <ShieldCheck className="w-6 h-6 mr-2 text-purple-400" /> Admin Login
            </CardTitle>
            <CardDescription className="text-gray-300">
              Enter the designated admin wallet address to access the panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="admin-address" className="text-purple-300">
                Admin Wallet Address
              </Label>
              <Input
                id="admin-address"
                type="text"
                value={adminAddress}
                onChange={(e) => setAdminAddress(e.target.value)}
                placeholder="0x..."
                className="bg-gray-800 border-purple-500/50 text-white placeholder:text-gray-400"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {isLoading ? "Authenticating..." : "Login as Admin"}
            </Button>
            <p className="text-sm text-gray-400 text-center">
              **IMPORTANT**: The admin address is configured via environment variable `ADMIN_WALLET_ADDRESS`.
            </p>
          </CardContent>
        </Card>
        <Toaster theme="dark" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-4">
      <div className="container mx-auto py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center">
            <ShieldCheck className="w-10 h-10 mr-3 text-purple-400" /> Admin Panel
          </h1>
          <p className="text-cyan-300 mt-2 text-lg">Manage promise deletion requests and view data</p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="mt-4 border-gray-600 hover:bg-gray-800 bg-transparent text-white"
          >
            Logout
          </Button>
        </motion.div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-purple-300">Pending Delete Requests ({deleteRequests.length})</h2>
          <Button
            onClick={() => fetchDeleteRequests(adminAddress)}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Refresh Requests
          </Button>
        </div>

        {deleteRequests.length === 0 && !isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <p className="text-gray-300 text-xl">🎉 No pending delete requests!</p>
          </motion.div>
        )}

        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {deleteRequests.map((request) => (
            <Card key={request.id} className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg text-red-400 flex items-center">
                    <Trash2 className="w-5 h-5 mr-2" /> Delete Request
                  </CardTitle>
                  <Badge className="bg-yellow-600 text-white">Pending</Badge>
                </div>
                <CardDescription className="text-gray-300 mt-2">
                  Promise ID: {request.promiseId.slice(0, 8)}...{request.promiseId.slice(-8)}
                </CardDescription>
                <CardDescription className="text-gray-300">
                  Requested by: {request.requesterAddress.slice(0, 6)}...{request.requesterAddress.slice(-4)}
                </CardDescription>
                <CardDescription className="text-gray-400 text-sm">
                  Requested At: {new Date(request.requestedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  onClick={() => handleApprove(request.id)}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button
                  onClick={() => handleReject(request.id)}
                  className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Reject
                </Button>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* All Promises Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-orange-300">All Promises ({allPromises.length})</h2>
          <Button
            onClick={() => fetchAllPromises(adminAddress)}
            disabled={isLoading}
            className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
            Refresh Promises
          </Button>
        </div>
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {allPromises.length === 0 && !isLoading ? (
            <p className="text-gray-300 text-lg col-span-full text-center">No promises created yet.</p>
          ) : (
            allPromises.map((promise) => (
              <Card key={promise.id} className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-orange-400 flex items-center">
                    <Target className="w-5 h-5 mr-2" /> Promise: {promise.message.slice(0, 30)}...
                  </CardTitle>
                  <CardDescription className="text-gray-300">ID: {promise.id.slice(0, 8)}...</CardDescription>
                  <CardDescription className="text-gray-300">Owner: {promise.address}</CardDescription>
                  <CardDescription className="text-gray-400 text-sm">Status: {promise.status}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor={`progress-${promise.id}`} className="text-orange-300">
                      Progress (%)
                    </Label>
                    <Input
                      id={`progress-${promise.id}`}
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={promise.adminAdjustedProgress || 0} // Use adminAdjustedProgress if set
                      onBlur={(e) => {
                        const newProgress = Number.parseInt(e.target.value)
                        if (!isNaN(newProgress)) {
                          handleUpdatePromiseProgress(promise.id, newProgress)
                        }
                      }}
                      className="bg-gray-800 border-orange-500/50 text-white placeholder:text-gray-400"
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const inputElement = document.getElementById(`progress-${promise.id}`) as HTMLInputElement
                      const newProgress = Number.parseInt(inputElement.value)
                      if (!isNaN(newProgress)) {
                        handleUpdatePromiseProgress(promise.id, newProgress)
                      }
                    }}
                    className="w-full bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700"
                    disabled={isLoading}
                  >
                    Update Progress
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>

        {/* All Users Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-blue-300">All Registered Users ({allUsers.length})</h2>
          <Button
            onClick={() => fetchAllUsers(adminAddress)}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Refresh Users
          </Button>
        </div>
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {allUsers.length === 0 && !isLoading ? (
            <p className="text-gray-300 text-lg col-span-full text-center">No users registered yet.</p>
          ) : (
            allUsers.map((user) => (
              <Card key={user.address} className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-400 flex items-center">
                    <Users className="w-5 h-5 mr-2" /> User: {user.address} {/* Display full address */}
                  </CardTitle>
                  <CardDescription className="text-gray-300">Reputation: {user.reputation}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-gray-300">
                  <p>Completed Promises: {user.completed_promises}</p>
                  <p>Failed Promises: {user.failed_promises}</p>
                  <p>Total Promises: {user.total_promises}</p>
                  <p>Streak: {user.streak}</p>
                  <p>Level: {user.level}</p>
                  <p>Joined: {new Date(user.joined_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>

        {/* All Sessions Section (Simulated IPs) */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-green-300">All Active Sessions ({allSessions.length})</h2>
          <Button
            onClick={() => fetchAllSessions(adminAddress)}
            disabled={isLoading}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Refresh Sessions
          </Button>
        </div>
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allSessions.length === 0 && !isLoading ? (
            <p className="text-gray-300 text-lg col-span-full text-center">No active sessions yet.</p>
          ) : (
            allSessions.map((session, index) => (
              <Card
                key={session.session_id || index}
                className="bg-white/10 backdrop-blur-sm border-white/20 text-white"
              >
                <CardHeader>
                  <CardTitle className="text-lg text-green-400 flex items-center">
                    <Globe className="w-5 h-5 mr-2" /> Session ID: {session.session_id.slice(0, 8)}...
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-300">
                  <p>IP: {session.ip}</p>
                  <p>First Visit: {new Date(session.first_visit).toLocaleString()}</p>
                  <p>Last Active: {new Date(session.last_active).toLocaleString()}</p>
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>
      </div>
      <Toaster theme="dark" />
    </div>
  )
}
