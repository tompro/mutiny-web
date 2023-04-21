import { DeleteEverything } from "~/components/DeleteEverything";
import KitchenSink from "~/components/KitchenSink";
import NavBar from "~/components/NavBar";
import { Card, DefaultMain, LargeHeader, NodeManagerGuard, SafeArea, SmallHeader, VStack } from "~/components/layout";

export default function Admin() {
    return (
        <NodeManagerGuard>
            <SafeArea>
                <DefaultMain>
                    <LargeHeader>Admin</LargeHeader>
                    <VStack>
                        <Card><p>If you know what you're doing you're in the right place!</p></Card>
                        <KitchenSink />
                        <div class='rounded-xl p-4 flex flex-col gap-2 bg-m-red overflow-x-hidden'>
                            <SmallHeader>Danger zone</SmallHeader>
                            <DeleteEverything />
                        </div>
                    </VStack>
                </DefaultMain>
                <NavBar activeTab="none" />
            </SafeArea>
        </NodeManagerGuard>
    )
}