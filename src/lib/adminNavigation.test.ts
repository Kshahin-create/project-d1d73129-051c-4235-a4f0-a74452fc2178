import { describe,it,expect } from "vitest";
import { activeAdminGroup,redirectedAdminHref,recordHref,isAdminNavActive } from "./adminNavigation";
import { canExportList,canReadFinance,safeSearch } from "./adminData";
describe("admin navigation boundaries",()=>{
 it("keeps old developer parameters and anchors",()=>expect(redirectedAdminHref("/api-docs","?tab=units","#overview")).toBe("/admin/settings/developers/api-docs?tab=units#overview"));
 it("redirects legacy party ids without inventing a party",()=>expect(redirectedAdminHref("/crm/party/123","?tab=contracts")).toBe("/admin/parties/123?tab=contracts"));
 it("leaves all three home routes unchanged before prompt 8",()=>{for(const path of ["/dashboard","/admin","/control"])expect(redirectedAdminHref(path)).toBeNull();});
 it("assigns record tabs to their parent navigation section",()=>{expect(activeAdminGroup(recordHref("units","u1"))).toBe("units");expect(activeAdminGroup(recordHref("receipts","r1"))).toBe("finance");});
 it("prevents sales agents from financial reads",()=>expect(canReadFinance({isAdmin:false,isManager:false,isAccountant:false,isLeasingManager:false})).toBe(false));
 it("does not grant new unit exports to control",()=>expect(canExportList("units",{isAdmin:false,isManager:false,isAccountant:false,isLeasingManager:false,isSalesAgent:false})).toBe(false));
 it("removes query operators from user search",()=>expect(safeSearch("155,(status.eq.available)%")).toBe("155status.eq.available"));
 it("groups data quality, audit and help under settings",()=>{for(const path of ["/admin/data-quality","/admin/system-log","/admin/help","/admin/settings/tasks"])expect(activeAdminGroup(path)).toBe("settings");});
 it("groups team followup with customers",()=>expect(activeAdminGroup("/admin/followup")).toBe("customers"));
 it("recognizes existing home aliases without redirecting",()=>{for(const path of ["/admin","/dashboard","/control"])expect(isAdminNavActive(path,"/admin")).toBe(true);expect(isAdminNavActive("/admin/tasks","/admin")).toBe(false);});
 it("highlights record parents without highlighting sibling lists",()=>{expect(isAdminNavActive("/admin/units/unit-155","/admin/units")).toBe(true);expect(isAdminNavActive("/admin/opportunities/team","/admin/opportunities")).toBe(false);expect(isAdminNavActive("/admin/units-incomplete","/admin/units")).toBe(false);});
});