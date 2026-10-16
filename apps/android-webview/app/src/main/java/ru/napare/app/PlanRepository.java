package ru.napare.app;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/** Private, device-local manual plans. Never imports website credentials or student records. */
final class PlanRepository {
    static final int LIMIT = 200;
    private final File file;
    PlanRepository(File directory) { file = new File(directory, "offline-plan-v1.bin"); }
    static final class Entry {
        final String id, date, time, title, note;
        final boolean done;
        Entry(String id, String date, String time, String title, String note, boolean done) {
            UUID.fromString(id); LocalDate.parse(date);
            if (!time.isEmpty()) LocalTime.parse(time);
            if (title.trim().isEmpty() || title.length() > 160 || note.length() > 1000) throw new IllegalArgumentException("Invalid plan");
            this.id=id; this.date=date; this.time=time; this.title=title.trim(); this.note=note; this.done=done;
        }
    }
    synchronized List<Entry> load() throws IOException {
        List<Entry> entries = new ArrayList<>();
        if (!file.exists()) return entries;
        try (DataInputStream input = new DataInputStream(new FileInputStream(file))) {
            if (input.readInt() != 0x4e505031) throw new IOException("Unknown plan format");
            int count=input.readInt();
            if (count < 0 || count > LIMIT) throw new IOException("Invalid plan count");
            for (int i=0;i<count;i++) entries.add(new Entry(input.readUTF(),input.readUTF(),input.readUTF(),input.readUTF(),input.readUTF(),input.readBoolean()));
            if (input.read() != -1) throw new IOException("Unexpected plan data");
        } catch (IllegalArgumentException | java.time.DateTimeException error) { throw new IOException("Invalid plan data", error); }
        entries.sort(Comparator.comparing((Entry e)->e.date).thenComparing(e->e.time).thenComparing(e->e.title));
        return entries;
    }
    synchronized void save(List<Entry> entries) throws IOException {
        if (entries.size() > LIMIT) throw new IOException("Plan limit reached");
        File temp = new File(file.getParentFile(), "offline-plan-v1.tmp");
        try {
            try (FileOutputStream stream = new FileOutputStream(temp); DataOutputStream output = new DataOutputStream(stream)) {
                output.writeInt(0x4e505031); output.writeInt(entries.size());
                for (Entry e:entries) { output.writeUTF(e.id);output.writeUTF(e.date);output.writeUTF(e.time);output.writeUTF(e.title);output.writeUTF(e.note);output.writeBoolean(e.done); }
                output.flush(); stream.getFD().sync();
            }
            Files.move(temp.toPath(),file.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temp.toPath()); }
    }
    synchronized void clear() throws IOException { Files.deleteIfExists(file.toPath()); }
}
