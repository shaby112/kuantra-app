import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { signIn, saveAuth } from "@/lib/auth";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await signIn({ username, password });
      saveAuth(res);
      toast({ title: "Signed in", description: "Welcome back!" });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Sign in failed",
        description: err?.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full mx-auto"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to home
          </Link>

          <div className="mb-8">
            <Logo size="lg" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Sign in
          </h1>
          <p className="text-muted-foreground mb-8">
            Use your username (or email) and password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Username or Email
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe or you@company.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-12 bg-secondary/50 border-border focus:border-primary focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12 bg-secondary/50 border-border focus:border-primary focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 glow-primary-subtle transition-all duration-300"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

