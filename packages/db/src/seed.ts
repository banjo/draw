import { prisma } from ".";

async function main() {
    console.log("Done with seed!");
}

main()
    .then(async () => {
        await prisma.$disconnect();
        return process.exit(0);
    })
    // eslint-disable-next-line unicorn/prefer-top-level-await
    .catch(async error => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
