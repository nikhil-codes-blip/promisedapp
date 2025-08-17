"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PencilIcon } from "lucide-react"

interface PromiseCardProps {
  promiseId: string
  title: string
  description: string
  status: "completed" | "failed" | "active"
  reputationChange: number
  userName: string // New prop for user's real name
  onEditPromise: (id: string) => void // Callback for edit button
}

export function PromiseCard({
  promiseId,
  title,
  description,
  status,
  reputationChange,
  userName,
  onEditPromise,
}: PromiseCardProps) {
  const statusColor = status === "completed" ? "text-green-500" : status === "failed" ? "text-red-500" : "text-blue-500"
  const reputationColor = reputationChange >= 0 ? "text-green-500" : "text-red-500"

  return (
    <Card className="w-full max-w-sm bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-lg rounded-xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEditPromise(promiseId)}
          className="text-white hover:bg-white/20"
          aria-label="Edit Promise"
        >
          <PencilIcon className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="text-sm opacity-90">{description}</p>
        <div className="flex items-center justify-between text-sm">
          <span className={`font-medium ${statusColor}`}>
            Status: {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          <span className={`font-medium ${reputationColor}`}>
            Reputation: {reputationChange > 0 ? "+" : ""}
            {reputationChange}
          </span>
        </div>
        {/* User Name Tag */}
        <div className="flex items-center text-sm opacity-80">
          <span className="font-medium mr-2">Committed by:</span>
          <span className="font-semibold">{userName}</span>
        </div>
      </CardContent>
    </Card>
  )
}
