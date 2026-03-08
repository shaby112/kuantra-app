import { useState } from "react";
import { Shield, Lock, Eye, Key, Bell, User, Database, Globe, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function SettingsView() {
    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto bg-background/50">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your workspace preferences and security.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Security Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                Privacy & Security
                            </CardTitle>
                            <CardDescription>Control how your data is handled and secure your account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Anonymize Analytics</Label>
                                    <p className="text-sm text-muted-foreground">Hide sensitive values in AI-generated reports and previews.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Secure SQL Transactions</Label>
                                    <p className="text-sm text-muted-foreground">Always run write queries in dry-run mode first.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Two-Factor Authentication</Label>
                                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                                </div>
                                <Button variant="outline" size="sm">Enable 2FA</Button>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Session Timeout</Label>
                                    <p className="text-sm text-muted-foreground">Automatically log out after inactivity.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input type="number" className="w-20 h-8" defaultValue={30} />
                                    <span className="text-xs text-muted-foreground">min</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" />
                                API Keys
                            </CardTitle>
                            <CardDescription>Manage keys used for external integrations and CLI tools.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Production Key</p>
                                        <p className="text-xs text-muted-foreground">Created on Oct 12, 2023</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm">Revoke</Button>
                            </div>
                            <Button className="w-full gap-2" variant="outline">
                                <Lock className="w-4 h-4" />
                                Create New Key
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10">
                                <User className="w-4 h-4" /> Edit Profile
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10">
                                <Bell className="w-4 h-4" /> Notifications
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10">
                                <Database className="w-4 h-4" /> Data Export
                            </Button>
                            <Separator className="my-2" />
                            <Button variant="ghost" className="w-full justify-start gap-2 h-10 text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" /> Delete Account
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 bg-primary/5">
                        <CardContent className="pt-6">
                            <div className="text-center space-y-2">
                                <Lock className="w-8 h-8 text-primary mx-auto mb-2" />
                                <h3 className="font-bold">Enterprise ready?</h3>
                                <p className="text-sm text-muted-foreground">Unlock SSO, SAML, and audit logs with our Enterprise plan.</p>
                                <Button className="w-full mt-4 bg-primary text-white">Upgrade Now</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
