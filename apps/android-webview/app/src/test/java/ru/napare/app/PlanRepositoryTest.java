package ru.napare.app;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.file.Files;
import java.util.*;

public class PlanRepositoryTest {
    private PlanRepository.Entry entry(String date,String time,boolean done) { return new PlanRepository.Entry(UUID.randomUUID().toString(),date,time,"Высшая математика","Аудитория 422 · взять тетрадь",done); }
    @Test public void survivesCloseReopenAndKeepsUnicodeAndCompletion() throws Exception {
        File directory=Files.createTempDirectory("napare-plan-test").toFile();
        PlanRepository repository=new PlanRepository(directory);repository.save(Arrays.asList(entry("2026-10-17","08:30",true)));
        PlanRepository.Entry saved=new PlanRepository(directory).load().get(0);
        assertTrue(saved.done);assertEquals("Высшая математика",saved.title);assertEquals("Аудитория 422 · взять тетрадь",saved.note);
    }
    @Test public void sortsByDayThenTime() throws Exception {
        PlanRepository repository=new PlanRepository(Files.createTempDirectory("napare-plan-test").toFile());
        repository.save(Arrays.asList(entry("2026-10-18","08:30",false),entry("2026-10-17","14:00",false),entry("2026-10-17","08:30",false)));
        List<PlanRepository.Entry> loaded=repository.load();assertEquals("08:30",loaded.get(0).time);assertEquals("2026-10-18",loaded.get(2).date);
    }
    @Test public void clearRemovesPlansAndDoesNotTouchOtherFiles() throws Exception {
        File directory=Files.createTempDirectory("napare-plan-test").toFile(), other=new File(directory,"other.bin");Files.write(other.toPath(),new byte[]{5});
        PlanRepository repository=new PlanRepository(directory);repository.save(Arrays.asList(entry("2026-10-17","",false)));repository.clear();assertTrue(repository.load().isEmpty());assertTrue(other.exists());
    }
    @Test public void rejectsCorruptDataWithoutReplacingIt() throws Exception {
        File directory=Files.createTempDirectory("napare-plan-test").toFile(), file=new File(directory,"offline-plan-v1.bin");byte[] original={1,2,3,4};Files.write(file.toPath(),original);
        assertThrows(IOException.class,()->new PlanRepository(directory).load());assertArrayEquals(original,Files.readAllBytes(file.toPath()));
    }
    @Test public void rejectedOversizedWritePreservesPreviousPlan() throws Exception {
        PlanRepository repository=new PlanRepository(Files.createTempDirectory("napare-plan-test").toFile());repository.save(Arrays.asList(entry("2026-10-17","",false)));
        List<PlanRepository.Entry> many=new ArrayList<>();for(int i=0;i<=PlanRepository.LIMIT;i++)many.add(entry("2026-10-17","",false));
        assertThrows(IOException.class,()->repository.save(many));assertEquals(1,repository.load().size());
    }
    @Test public void replacementPersistsAndInvalidFieldsAreRejected() throws Exception {
        PlanRepository repository=new PlanRepository(Files.createTempDirectory("napare-plan-test").toFile());repository.save(Arrays.asList(entry("2026-10-17","08:30",false)));repository.save(Collections.emptyList());assertTrue(repository.load().isEmpty());
        assertThrows(IllegalArgumentException.class,()->new PlanRepository.Entry(UUID.randomUUID().toString(),"2026-10-17",""," ","",false));
        assertThrows(java.time.DateTimeException.class,()->entry("2026-99-99","08:30",false));
    }
}
