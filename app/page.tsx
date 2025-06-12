"use client"

import { useState, useCallback, useEffect } from "react"
import { ethers } from "ethers"
import { anvil, sepolia } from "viem/chains"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getContracts } from "@/lib/get-contracts"
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Zap,
  Eye,
  DollarSign,
  Network,
  ChevronDown,
  ChevronUp,
  FileText,
  Key,
  Wallet,
} from "lucide-react"

interface ContractFunction {
  name: string
  type: string
  stateMutability: string
  inputs: Array<{
    name: string
    type: string
    internalType?: string
  }>
  outputs: Array<{
    name: string
    type: string
    internalType?: string
  }>
}

interface FunctionResult {
  functionName: string
  inputs: Record<string, any>
  result: any
  error?: string
  gasUsed?: string
  transactionHash?: string
  timestamp: number
}

interface ContractFile {
  name: string
  address: string
  abi: any[]
}

export default function SmartContractDebugger() {
  const [privateKey, setPrivateKey] = useState("")
  const [selectedChain, setSelectedChain] = useState<"anvil" | "sepolia">("sepolia")
  const [selectedContract, setSelectedContract] = useState<string>("")
  const [authMethod, setAuthMethod] = useState<"privateKey" | "browserWallet">("browserWallet")
  const [connectingWallet, setConnectingWallet] = useState(false)

  const [parsedAbi, setParsedAbi] = useState<ContractFunction[]>([])
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [wallet, setWallet] = useState<ethers.Wallet | ethers.Signer | null>(null)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState("")

  const [functionInputs, setFunctionInputs] = useState<Record<string, Record<string, string>>>({})
  const [functionResults, setFunctionResults] = useState<FunctionResult[]>([])
  const [latestFunctionResults, setLatestFunctionResults] = useState<Record<string, FunctionResult>>({})
  const [loadingFunctions, setLoadingFunctions] = useState<Set<string>>(new Set())

  const [configExpanded, setConfigExpanded] = useState(true)
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set())

  const [contractFiles, setContractFiles] = useState<ContractFile[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [currentContractData, setCurrentContractData] = useState<{ address: string; abi: any[] } | null>(null)

  const toggleFunctionExpanded = (functionName: string) => {
    setExpandedFunctions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(functionName)) {
        newSet.delete(functionName)
      } else {
        newSet.add(functionName)
      }
      return newSet
    })
  }

  const chains = {
    anvil: {
      name: "Anvil (Local)",
      chain: anvil,
      rpcUrl: anvil.rpcUrls.default.http,
      description: "Local development network",
    },
    sepolia: {
      name: "Sepolia Testnet",
      chain: sepolia,
      rpcUrl: sepolia.rpcUrls.default.http,
      description: "Ethereum testnet",
    },
  }

  // Check if browser wallet is available
  const [browserWalletAvailable, setBrowserWalletAvailable] = useState(false)

  useEffect(() => {
    const checkBrowserWallet = async () => {
      try {
        // Check if window.ethereum is available (MetaMask or other wallets)
        if (typeof window !== "undefined" && window.ethereum) {
          setBrowserWalletAvailable(true)
        } else {
          setBrowserWalletAvailable(false)
        }
      } catch (error) {
        console.error("Error checking browser wallet:", error)
        setBrowserWalletAvailable(false)
      }
    }

    checkBrowserWallet()
  }, [])

  // Load contract files on component mount
  useEffect(() => {
    const loadContractFiles = async () => {
      setLoadingContracts(true)
      try {
        const contractFileNames = await getContracts()
        
        const contracts: ContractFile[] = []

        for (const fileName of contractFileNames) {
          try {
            const response = await fetch(`/contracts/${fileName}`)
            if (response.ok) {
              const contractData = await response.json()
              if (contractData.address && contractData.abi) {
                contracts.push({
                  name: fileName
                    .replace(".json", "")
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase()),
                  address: contractData.address,
                  abi: contractData.abi,
                })
              }
            }
          } catch (error) {
            console.warn(`Failed to load contract file: ${fileName}`, error)
          }
        }

        setContractFiles(contracts)
      } catch (error) {
        console.error("Failed to load contract files:", error)
      } finally {
        setLoadingContracts(false)
      }
    }

    loadContractFiles()
  }, [])

  const handleContractSelection = (contractName: string) => {
    const selectedContractFile = contractFiles.find((c) => c.name === contractName)
    if (selectedContractFile) {
      setSelectedContract(contractName)
      setCurrentContractData({
        address: selectedContractFile.address,
        abi: selectedContractFile.abi,
      })
    }
  }

  const connectBrowserWallet = async () => {
    if (!window.ethereum) {
      throw new Error("No browser wallet found. Please install MetaMask or another wallet extension.")
    }

    setConnectingWallet(true)
    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" })

      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()

      setWallet(signer)
      setWalletAddress(address)

      return { signer, address }
    } catch (error: any) {
      console.error("Error connecting browser wallet:", error)
      throw new Error(`Failed to connect wallet: ${error.message}`)
    } finally {
      setConnectingWallet(false)
    }
  }

  const connectPrivateKey = async (privateKey: string, rpcUrl: string) => {
    setConnectingWallet(true)
    try {
      // Create provider and wallet
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const walletInstance = new ethers.Wallet(privateKey, provider)
      const address = await walletInstance.getAddress()

      setWallet(walletInstance)
      setWalletAddress(address)

      return { signer: walletInstance, address }
    } catch (error: any) {
      console.error("Error connecting with private key:", error)
      throw new Error(`Invalid private key or RPC URL: ${error.message}`)
    } finally {
      setConnectingWallet(false)
    }
  }

  const connectToContract = useCallback(async () => {
    try {
      setConnectionError("")

      // Validate contract selection
      if (!currentContractData) {
        throw new Error("Please select a contract")
      }

      // Get selected chain configuration
      const chainConfig = chains[selectedChain]

      let signer: ethers.Wallet | ethers.Signer
      let address: string

      // Connect wallet based on selected method
      if (authMethod === "browserWallet") {
        const result = await connectBrowserWallet()
        signer = result.signer
        address = result.address
      } else {
        // Validate private key
        if (!privateKey) {
          throw new Error("Please enter your private key")
        }
        const result = await connectPrivateKey(privateKey, chainConfig.rpcUrl)
        signer = result.signer
        address = result.address
      }

      // Parse ABI
      const functions = currentContractData.abi.filter((item: any) => item.type === "function")
      setParsedAbi(functions)

      // Initialize all functions as expanded
      setExpandedFunctions(new Set(functions.map((f) => f.name)))

      // Clear previous results
      setLatestFunctionResults({})
      setFunctionResults([])

      // Create contract instance
      const contractInstance = new ethers.Contract(currentContractData.address, currentContractData.abi, signer)
      setContract(contractInstance)

      setIsConnected(true)
    } catch (error: any) {
      setConnectionError(error.message)
      setIsConnected(false)
    }
  }, [currentContractData, privateKey, selectedChain, authMethod])

  const handleInputChange = (functionName: string, inputName: string, value: string) => {
    setFunctionInputs((prev) => ({
      ...prev,
      [functionName]: {
        ...prev[functionName],
        [inputName]: value,
      },
    }))
  }

  const executeFunction = async (func: ContractFunction) => {
    if (!contract || !wallet) return

    const functionName = func.name
    setLoadingFunctions((prev) => new Set(prev).add(functionName))

    try {
      const inputs = functionInputs[functionName] || {}
      const args = func.inputs.map((input) => {
        const value = inputs[input.name] || ""

        // Convert input based on type
        if (input.type.includes("uint") || input.type.includes("int")) {
          return value ? ethers.getBigInt(value) : 0n
        } else if (input.type === "bool") {
          return value.toLowerCase() === "true"
        } else if (input.type.includes("[]")) {
          try {
            return JSON.parse(value || "[]")
          } catch {
            return []
          }
        }
        return value
      })

      let result: any
      let gasUsed: string | undefined
      let transactionHash: string | undefined

      if (func.stateMutability === "view" || func.stateMutability === "pure") {
        // Read-only function
        result = await contract[functionName](...args)
      } else {
        // State-changing function
        const tx = await contract[functionName](...args)
        transactionHash = tx.hash
        const receipt = await tx.wait()
        gasUsed = receipt.gasUsed.toString()
        result = receipt
      }

      // Format result for display
      let formattedResult = result
      if (typeof result === "bigint") {
        formattedResult = result.toString()
      } else if (Array.isArray(result)) {
        formattedResult = result.map((item) => (typeof item === "bigint" ? item.toString() : item))
      } else if (result && typeof result === "object") {
        formattedResult = Object.fromEntries(
          Object.entries(result).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]),
        )
      }

      const functionResult: FunctionResult = {
        functionName,
        inputs: { ...inputs },
        result: formattedResult,
        gasUsed,
        transactionHash,
        timestamp: Date.now(),
      }

      // Update both global results and latest function result
      setFunctionResults((prev) => [functionResult, ...prev])
      setLatestFunctionResults((prev) => ({
        ...prev,
        [functionName]: functionResult,
      }))
    } catch (error: any) {
      const functionResult: FunctionResult = {
        functionName,
        inputs: { ...functionInputs[functionName] },
        result: null,
        error: error.message,
        timestamp: Date.now(),
      }

      // Update both global results and latest function result
      setFunctionResults((prev) => [functionResult, ...prev])
      setLatestFunctionResults((prev) => ({
        ...prev,
        [functionName]: functionResult,
      }))
    } finally {
      setLoadingFunctions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(functionName)
        return newSet
      })
    }
  }

  const getFunctionIcon = (stateMutability: string) => {
    switch (stateMutability) {
      case "view":
      case "pure":
        return <Eye className="w-4 h-4" />
      case "payable":
        return <DollarSign className="w-4 h-4" />
      default:
        return <Zap className="w-4 h-4" />
    }
  }

  const getFunctionColor = (stateMutability: string) => {
    switch (stateMutability) {
      case "view":
      case "pure":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "payable":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-orange-100 text-orange-800 border-orange-200"
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Smart Contract Debugger</h1>
        <p className="text-muted-foreground">
          Debug and interact with smart contracts by selecting a pre-configured contract and connecting your wallet.
        </p>
      </div>

      {/* Configuration Panel */}
      <Card className="mt-6">
        <Collapsible open={configExpanded} onOpenChange={setConfigExpanded}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
              <div>
                <CardTitle>Contract Configuration</CardTitle>
                <CardDescription>Select a contract and connect your wallet</CardDescription>
              </div>
              {configExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="network">Network</Label>
                <Select value={selectedChain} onValueChange={(value: "anvil" | "sepolia") => setSelectedChain(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a network" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(chains).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Network className="w-4 h-4" />
                          <div className="flex flex-col items-start">
                            <div className="font-medium">{config.name}</div>
                            <div className="text-xs text-muted-foreground">{config.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">RPC URL: {chains[selectedChain].rpcUrl}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-files">Select Contract</Label>
                <Select value={selectedContract} onValueChange={handleContractSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingContracts ? "Loading contracts..." : "Select a contract"} />
                  </SelectTrigger>
                  <SelectContent>
                    {contractFiles.map((contractFile) => (
                      <SelectItem key={contractFile.name} value={contractFile.name}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <div className="flex flex-col items-start">
                            <div className="font-medium">{contractFile.name}</div>
                            <div className="text-xs text-muted-foreground">{contractFile.address}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {contractFiles.length > 0
                    ? `Found ${contractFiles.length} contracts in /contracts folder`
                    : "No contracts found in /contracts folder"}
                </p>
              </div>

              {currentContractData && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div>
                        <strong>Contract Address:</strong> {currentContractData.address}
                      </div>
                      <div>
                        <strong>Functions:</strong>{" "}
                        {currentContractData.abi.filter((item) => item.type === "function").length}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Wallet Connection</Label>
                <Tabs
                  defaultValue={browserWalletAvailable ? "browserWallet" : "privateKey"}
                  value={authMethod}
                  onValueChange={(value) => setAuthMethod(value as "browserWallet" | "privateKey")}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="browserWallet" disabled={!browserWalletAvailable}>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        <span>Browser Wallet</span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="privateKey">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        <span>Private Key</span>
                      </div>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="browserWallet" className="mt-2">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Connect using your browser wallet extension (MetaMask, etc.)
                      </p>
                      {!browserWalletAvailable && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            No browser wallet detected. Please install MetaMask or another wallet extension.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="privateKey" className="mt-2">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Enter your private key to connect</p>
                      <Input
                        id="private-key"
                        type="password"
                        placeholder="0x..."
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Warning: Entering your private key is not recommended for production use.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Button
                onClick={connectToContract}
                className="w-full"
                disabled={
                  !currentContractData ||
                  (authMethod === "privateKey" && !privateKey) ||
                  connectingWallet ||
                  (authMethod === "browserWallet" && !browserWalletAvailable)
                }
              >
                {connectingWallet ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : isConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Connected
                  </>
                ) : (
                  "Connect to Contract"
                )}
              </Button>

              {connectionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              {isConnected && walletAddress && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div>
                        <strong>Network:</strong> {chains[selectedChain].name}
                      </div>
                      <div>
                        <strong>Wallet:</strong> {walletAddress}
                      </div>
                      <div>
                        <strong>Connection Type:</strong>{" "}
                        {authMethod === "browserWallet" ? "Browser Wallet" : "Private Key"}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Function Interface */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Contract Functions</CardTitle>
          <CardDescription>
            {parsedAbi.length > 0
              ? `Found ${parsedAbi.length} functions in the contract`
              : "Connect to contract to see available functions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parsedAbi.length > 0 ? (
            <div className="space-y-4">
              {parsedAbi.map((func, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <Collapsible open={expandedFunctions.has(func.name)}>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader
                        className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleFunctionExpanded(func.name)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getFunctionIcon(func.stateMutability)}
                            <h3 className="font-semibold">{func.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getFunctionColor(func.stateMutability)}>{func.stateMutability}</Badge>
                            {expandedFunctions.has(func.name) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-3">
                        {func.inputs.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Parameters:</Label>
                            {func.inputs.map((input, inputIndex) => (
                              <div key={inputIndex} className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  {input.name} ({input.type})
                                </Label>
                                <Input
                                  placeholder={`Enter ${input.type} value`}
                                  value={functionInputs[func.name]?.[input.name] || ""}
                                  onChange={(e) => handleInputChange(func.name, input.name, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <Button
                          onClick={() => executeFunction(func)}
                          disabled={!isConnected || loadingFunctions.has(func.name)}
                          className="w-full"
                        >
                          {loadingFunctions.has(func.name) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              {getFunctionIcon(func.stateMutability)}
                              <span className="ml-2">Execute {func.name}</span>
                            </>
                          )}
                        </Button>

                        {/* Function Result Display */}
                        {latestFunctionResults[func.name] && (
                          <div className="mt-4 p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium">Latest Result:</Label>
                              <Badge variant={latestFunctionResults[func.name].error ? "destructive" : "default"}>
                                {latestFunctionResults[func.name].error ? "Error" : "Success"}
                              </Badge>
                            </div>

                            {latestFunctionResults[func.name].error ? (
                              <pre className="text-xs bg-red-50 text-red-800 p-2 rounded overflow-x-auto">
                                {latestFunctionResults[func.name].error}
                              </pre>
                            ) : (
                              <pre className="text-xs bg-green-50 text-green-800 p-2 rounded overflow-x-auto">
                                {JSON.stringify(latestFunctionResults[func.name].result, null, 2)}
                              </pre>
                            )}

                            {latestFunctionResults[func.name].transactionHash && (
                              <div className="mt-2">
                                <Label className="text-xs font-medium">Transaction Hash:</Label>
                                <p className="text-xs font-mono bg-muted p-1 rounded mt-1 break-all">
                                  {latestFunctionResults[func.name].transactionHash}
                                </p>
                              </div>
                            )}

                            {latestFunctionResults[func.name].gasUsed && (
                              <div className="mt-2">
                                <Label className="text-xs font-medium">Gas Used:</Label>
                                <p className="text-xs bg-muted p-1 rounded mt-1">
                                  {latestFunctionResults[func.name].gasUsed}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Connect to a contract to see available functions
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results History Panel */}
      {functionResults.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Results History</CardTitle>
            <CardDescription>Complete history of all executed contract functions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {functionResults.map((result, index) => (
                  <Card
                    key={index}
                    className={`border-l-4 ${result.error ? "border-l-red-500" : "border-l-green-500"}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{result.functionName}</h4>
                        <Badge variant={result.error ? "destructive" : "default"}>
                          {result.error ? "Error" : "Success"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(result.timestamp).toLocaleString()}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.keys(result.inputs).length > 0 && (
                        <div>
                          <Label className="text-sm font-medium">Inputs:</Label>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(result.inputs, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div>
                        <Label className="text-sm font-medium">{result.error ? "Error:" : "Result:"}</Label>
                        <pre
                          className={`text-xs p-2 rounded mt-1 overflow-x-auto ${
                            result.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"
                          }`}
                        >
                          {result.error || JSON.stringify(result.result, null, 2)}
                        </pre>
                      </div>

                      {result.transactionHash && (
                        <div>
                          <Label className="text-sm font-medium">Transaction Hash:</Label>
                          <p className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">
                            {result.transactionHash}
                          </p>
                        </div>
                      )}

                      {result.gasUsed && (
                        <div>
                          <Label className="text-sm font-medium">Gas Used:</Label>
                          <p className="text-xs bg-muted p-2 rounded mt-1">{result.gasUsed}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
