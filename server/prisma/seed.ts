import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 12);

  const demoUsers = [
    { username: 'alice', email: 'alice@example.com', displayName: 'Alice Johnson', bio: 'Designer & coffee lover ☕' },
    { username: 'bob', email: 'bob@example.com', displayName: 'Bob Smith', bio: 'Backend engineer' },
    { username: 'carol', email: 'carol@example.com', displayName: 'Carol Williams', bio: 'Product manager' },
  ];

  const users = [];
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: password },
    });
    users.push(user);
  }

  // Seed a conversation between alice and bob with a few messages.
  const [alice, bob] = users;
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: alice.id } } },
        { participants: { some: { userId: bob.id } } },
      ],
    },
  });

  if (!existing) {
    const convo = await prisma.conversation.create({
      data: { participants: { create: [{ userId: alice.id }, { userId: bob.id }] } },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: convo.id, senderId: alice.id, content: 'Hey Bob! 👋' },
        { conversationId: convo.id, senderId: bob.id, content: 'Hi Alice, how are you?' },
        { conversationId: convo.id, senderId: alice.id, content: 'Doing great, just testing this new messenger!' },
      ],
    });
  }

  console.log('✅ Seed complete. Demo login: alice@example.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
