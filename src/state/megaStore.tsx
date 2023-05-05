/* @refresh reload */

// Inspired by https://github.com/solidjs/solid-realworld/blob/main/src/store/index.js
import { ParentComponent, createContext, createEffect, onCleanup, onMount, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { NodeManagerSettingStrings, setupNodeManager } from "~/logic/nodeManagerSetup";
import { MutinyBalance, NodeManager } from "@mutinywallet/mutiny-wasm";
import { ParsedParams } from "~/routes/Scanner";

const MegaStoreContext = createContext<MegaStore>();

type UserStatus = undefined | "new_here" | "waitlisted" | "approved" | "paid"

export type MegaStore = [{
    waitlist_id?: string;
    node_manager?: NodeManager;
    user_status: UserStatus;
    scan_result?: ParsedParams;
    balance?: MutinyBalance;
    is_syncing?: boolean;
    last_sync?: number;
    price: number
    has_backed_up: boolean,
    dismissed_restore_prompt: boolean
}, {
    fetchUserStatus(): Promise<UserStatus>;
    setupNodeManager(settings?: NodeManagerSettingStrings): Promise<void>;
    setWaitlistId(waitlist_id: string): void;
    setScanResult(scan_result: ParsedParams | undefined): void;
    sync(): Promise<void>;
    dismissRestorePrompt(): void;
    setHasBackedUp(): void;
}];

export const Provider: ParentComponent = (props) => {
    const [state, setState] = createStore({
        waitlist_id: localStorage.getItem("waitlist_id"),
        node_manager: undefined as NodeManager | undefined,
        user_status: undefined as UserStatus,
        scan_result: undefined as ParsedParams | undefined,
        // TODO: wire this up to real price once we have caching
        price: 30000,
        has_backed_up: localStorage.getItem("has_backed_up") === "true",
        balance: undefined as MutinyBalance | undefined,
        last_sync: undefined as number | undefined,
        is_syncing: false,
        dismissed_restore_prompt: localStorage.getItem("dismissed_restore_prompt") === "true"
    });

    const actions = {
        async fetchUserStatus(): Promise<UserStatus> {
            if (!state.waitlist_id) {
                return "new_here"
            }
            try {
                const res = await fetch(`https://waitlist.mutiny-waitlist.workers.dev/waitlist/${state.waitlist_id}`)
                const data = await res.json();

                if (data.approval_date) {
                    return "approved"
                } else {
                    return "waitlisted"
                }

            } catch (e) {
                return "new_here"
            }
        },
        async setupNodeManager(settings?: NodeManagerSettingStrings): Promise<void> {
            try {
                const nodeManager = await setupNodeManager(settings)
                setState({ node_manager: nodeManager })
            } catch (e) {
                console.error(e)
            }
        },
        setWaitlistId(waitlist_id: string) {
            setState({ waitlist_id })
        },
        async sync(): Promise<void> {
            console.time("BDK Sync Time")
            try {
                if (state.node_manager && !state.is_syncing) {
                    setState({ is_syncing: true })
                    await state.node_manager?.sync()
                    const balance = await state.node_manager?.get_balance();
                    setState({ balance, last_sync: Date.now() })
                }
            } catch (e) {
                console.error(e);
            } finally {
                setState({ is_syncing: false })
            }
            console.timeEnd("BDK Sync Time")
        },
        setScanResult(scan_result: ParsedParams) {
            setState({ scan_result })
        },
        setHasBackedUp() {
            localStorage.setItem("has_backed_up", "true")
            setState({ has_backed_up: true })
        },
        dismissRestorePrompt() {
            localStorage.setItem("dismissed_restore_prompt", "true")
            setState({ dismissed_restore_prompt: true })
        }
    };

    // Fetch status from remote on load
    onMount(() => {
        actions.fetchUserStatus().then(status => {
            setState({ user_status: status })
        })
    })

    // Only load node manager when status is approved
    createEffect(() => {
        if (state.user_status === "approved" && !state.node_manager) {
            console.log("running setup node manager...")
            actions.setupNodeManager().then(() => console.log("node manager setup done"))
        }
    })

    // Be reactive to changes in waitlist_id
    createEffect(() => {
        state.waitlist_id ? localStorage.setItem("waitlist_id", state.waitlist_id) : localStorage.removeItem("waitlist_id");
    });

    createEffect(() => {
        const interval = setInterval(async () => {
            await actions.sync();
        }, 60 * 1000); // Poll every minute

        onCleanup(() => {
            clearInterval(interval);
        });
    })

    const store = [state, actions] as MegaStore;

    return (
        <MegaStoreContext.Provider value={store}>
            {props.children}
        </MegaStoreContext.Provider>
    )
}

export function useMegaStore() {
    // This is a trick to narrow the typescript types: https://docs.solidjs.com/references/api-reference/component-apis/createContext
    const context = useContext(MegaStoreContext);
    if (!context) {
        throw new Error("useMegaStore: cannot find a MegaStoreContext")
    }
    return context;
}